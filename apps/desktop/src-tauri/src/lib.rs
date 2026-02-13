use serde::{Deserialize, Serialize};
use std::process::Command as StdCommand;
use std::sync::Mutex;
use tauri::{Manager, State};

/// Holds the server process state
struct ServerState {
    port: Mutex<Option<u16>>,
    server_pid: Mutex<Option<u32>>,
}

/// Health check response from the local server
#[derive(Debug, Deserialize)]
struct HealthResponse {
    ok: bool,
}

/// Keychain operation result
#[derive(Debug, Serialize)]
struct KeychainResult {
    success: bool,
    value: Option<String>,
    error: Option<String>,
}

/// Find an available port for the local server
fn find_available_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("Failed to bind to port");
    listener.local_addr().expect("Failed to get local addr").port()
}

/// Wait for the server to become healthy
async fn wait_for_server(port: u16, max_retries: u32) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{}/health", port);

    for attempt in 0..max_retries {
        match client.get(&url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    if let Ok(health) = resp.json::<HealthResponse>().await {
                            if health.ok {
                                return Ok(());
                            }
                        }
                }
            }
            Err(_) => {}
        }
        // Exponential backoff: 200ms, 400ms, 800ms, ...
        let delay = std::time::Duration::from_millis(200 * (1 << attempt.min(4)));
        tokio::time::sleep(delay).await;
    }

    Err(format!("Server did not become healthy after {} attempts", max_retries))
}

/// Tauri command: Start the embedded server
#[tauri::command]
async fn start_server(state: State<'_, ServerState>) -> Result<u16, String> {
    let mut port_lock = state.port.lock().map_err(|e| e.to_string())?;
    if let Some(port) = *port_lock {
        return Ok(port);
    }

    let port = find_available_port();

    // Spawn the Node.js server as a child process
    let child = StdCommand::new("node")
        .args(["--import", "tsx", "../server/src/main.ts"])
        .env("PORT", port.to_string())
        .env("HOST", "127.0.0.1")
        .spawn()
        .map_err(|e| format!("Failed to spawn server: {}", e))?;

    let pid = child.id();

    // Store the PID for cleanup
    {
        let mut pid_lock = state.server_pid.lock().map_err(|e| e.to_string())?;
        *pid_lock = Some(pid);
    }

    // Wait for the server to become healthy
    wait_for_server(port, 20).await?;

    *port_lock = Some(port);
    Ok(port)
}

/// Tauri command: Get the server port
#[tauri::command]
fn get_server_port(state: State<'_, ServerState>) -> Option<u16> {
    state.port.lock().ok().and_then(|lock| *lock)
}

/// Tauri command: Store API key in OS keychain
#[tauri::command]
fn keychain_set(service: String, key: String, value: String) -> KeychainResult {
    let entry_name = format!("worldmirror.{}.{}", service, key);
    match keyring::Entry::new(&entry_name, "worldmirror") {
        Ok(entry) => match entry.set_password(&value) {
            Ok(()) => KeychainResult {
                success: true,
                value: None,
                error: None,
            },
            Err(e) => KeychainResult {
                success: false,
                value: None,
                error: Some(format!("Failed to set keychain entry: {}", e)),
            },
        },
        Err(e) => KeychainResult {
            success: false,
            value: None,
            error: Some(format!("Failed to create keychain entry: {}", e)),
        },
    }
}

/// Tauri command: Retrieve API key from OS keychain
#[tauri::command]
fn keychain_get(service: String, key: String) -> KeychainResult {
    let entry_name = format!("worldmirror.{}.{}", service, key);
    match keyring::Entry::new(&entry_name, "worldmirror") {
        Ok(entry) => match entry.get_password() {
            Ok(password) => KeychainResult {
                success: true,
                value: Some(password),
                error: None,
            },
            Err(keyring::Error::NoEntry) => KeychainResult {
                success: true,
                value: None,
                error: None,
            },
            Err(e) => KeychainResult {
                success: false,
                value: None,
                error: Some(format!("Failed to get keychain entry: {}", e)),
            },
        },
        Err(e) => KeychainResult {
            success: false,
            value: None,
            error: Some(format!("Failed to create keychain entry: {}", e)),
        },
    }
}

/// Tauri command: Delete API key from OS keychain
#[tauri::command]
fn keychain_delete(service: String, key: String) -> KeychainResult {
    let entry_name = format!("worldmirror.{}.{}", service, key);
    match keyring::Entry::new(&entry_name, "worldmirror") {
        Ok(entry) => match entry.delete_credential() {
            Ok(()) => KeychainResult {
                success: true,
                value: None,
                error: None,
            },
            Err(keyring::Error::NoEntry) => KeychainResult {
                success: true,
                value: None,
                error: None,
            },
            Err(e) => KeychainResult {
                success: false,
                value: None,
                error: Some(format!("Failed to delete keychain entry: {}", e)),
            },
        },
        Err(e) => KeychainResult {
            success: false,
            value: None,
            error: Some(format!("Failed to create keychain entry: {}", e)),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .manage(ServerState {
            port: Mutex::new(None),
            server_pid: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_server,
            get_server_port,
            keychain_set,
            keychain_get,
            keychain_delete,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Cleanup: kill the server process on window close
                if let Some(state) = window.try_state::<ServerState>() {
                    if let Ok(pid_lock) = state.server_pid.lock() {
                        if let Some(pid) = *pid_lock {
                            #[cfg(unix)]
                            {
                                use std::process::Command;
                                let _ = Command::new("kill")
                                    .args(["-TERM", &pid.to_string()])
                                    .spawn();
                            }
                            #[cfg(windows)]
                            {
                                use std::process::Command;
                                let _ = Command::new("taskkill")
                                    .args(["/PID", &pid.to_string(), "/F"])
                                    .spawn();
                            }
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
