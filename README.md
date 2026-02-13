# 🌐 WorldMirror

A modular AI chatbot platform with persistent chat history, character cards, and multi-provider support. Built as a TypeScript monorepo with a Fastify API server and SvelteKit frontend.

---

## Features

- **Multi-Provider LLM Support** — Anthropic (Claude), Ollama (local models), and a built-in Mock provider for development
- **Character System** — Create, import, and export character cards (V1/V2 JSON, RisuAI JSON, PNG with embedded metadata)
- **Persistent Chat History** — SQLite-backed storage with cursor-paginated message retrieval
- **Swipe System** — Generate multiple AI responses per message and navigate between them
- **Sampler Presets** — Configure temperature, top-p, top-k, repetition penalty, and more with saveable presets
- **Prompt Engineering** — Token budgeting, macro expansion (`{{user}}`, `{{char}}`, `{{time}}`), and regex replacement pipelines
- **SSE Streaming** — Real-time token streaming via Server-Sent Events
- **Dark Mode UI** — Svelte 5 frontend with a polished dark theme

## Architecture

```
chatbot-frontend/
├── apps/
│   ├── server/          # Fastify API server
│   │   ├── migrations/  # SQLite schema migrations
│   │   └── src/
│   │       ├── api/routes/  # REST endpoints
│   │       ├── di/          # Dependency injection container
│   │       └── services/    # Business logic
│   └── web/             # SvelteKit frontend
│       └── src/
│           ├── lib/components/  # Svelte 5 components
│           └── routes/          # Page routes
├── packages/
│   ├── core/            # Providers, orchestration, character parsing
│   ├── db/              # SQLite client and repositories
│   ├── types/           # Shared TypeScript interfaces
│   ├── utils/           # Logger, ID generation, time helpers
│   └── storage/         # File storage abstraction
├── tests/               # Unit and integration tests
└── checks/              # Feature registry and verification
```

## Prerequisites

- **Node.js 22** (LTS) — required for `better-sqlite3` native compilation
- **pnpm 9+**

## Quick Start

```bash
# Clone
git clone https://github.com/solo125812/WorldMirror-chatbot-frontend.git
cd WorldMirror-chatbot-frontend

# Use Node 22 (if using nvm/fnm)
nvm use  # reads .node-version

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development servers (API + frontend)
pnpm dev
```

The API server runs on `http://localhost:3001` and the web frontend on `http://localhost:5173`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `HOST` | `localhost` | API server host |
| `ANTHROPIC_API_KEY` | — | Anthropic API key (optional) |
| `OPENAI_API_KEY` | — | OpenAI API key (optional) |
| `APP_DATA_DIR` | `./data` | Directory for SQLite database |
| `LOG_LEVEL` | `info` | Logging verbosity |

## API Endpoints

### Chat
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/chat` | Send message, get full response |
| `POST` | `/chat/stream` | Send message, stream SSE response |

### Characters
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/characters` | List characters (search, tags, pagination) |
| `GET` | `/characters/:id` | Get character |
| `POST` | `/characters` | Create character |
| `PATCH` | `/characters/:id` | Update character |
| `DELETE` | `/characters/:id` | Delete character |
| `POST` | `/characters/import` | Import JSON or PNG card |
| `GET` | `/characters/:id/export` | Export as V2 JSON |

### Chat History
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/chats` | List chats (pagination, character filter) |
| `GET` | `/chats/:id` | Get chat with messages |
| `GET` | `/chats/:id/messages` | Cursor-paginated messages |
| `DELETE` | `/chats/:id` | Delete chat |

### Sampler Presets
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sampler-presets` | List all presets |
| `POST` | `/sampler-presets` | Create preset |
| `PATCH` | `/sampler-presets/:id` | Update preset |
| `DELETE` | `/sampler-presets/:id` | Delete preset |

### System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/models` | List available models |
| `GET` | `/config` | Get app configuration |
| `PATCH` | `/config` | Update configuration |

## Scripts

```bash
pnpm dev          # Start dev servers (API + web)
pnpm build        # Production build
pnpm test         # Run all tests
pnpm test:watch   # Run tests in watch mode
pnpm typecheck    # TypeScript type checking
pnpm lint         # Lint all packages
```

## Testing

Tests use **Vitest** and are split into unit and integration suites:

```bash
pnpm test                              # Run all
npx vitest run tests/unit              # Unit tests only
npx vitest run tests/integration       # Integration tests only
```

Integration tests spin up a real Fastify server with an in-memory SQLite database.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Language | TypeScript 5.9 |
| API Server | Fastify |
| Frontend | SvelteKit + Svelte 5 |
| Database | SQLite via better-sqlite3 |
| Build | Turborepo |
| Package Manager | pnpm |
| Testing | Vitest |

## License

Private — all rights reserved.
