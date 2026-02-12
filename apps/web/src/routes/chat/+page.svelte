<script lang="ts">
  import { chatStore } from '$lib/stores/chatStore.svelte';

  let inputValue = $state('');
  let messagesContainer: HTMLElement;

  function scrollToBottom() {
    if (messagesContainer) {
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      });
    }
  }

  async function handleSend() {
    if (!inputValue.trim() || chatStore.isStreaming) return;
    const msg = inputValue;
    inputValue = '';
    await chatStore.sendMessage(msg);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Auto-scroll on new messages
  $effect(() => {
    // Access messages to trigger reactivity
    const _msgs = chatStore.messages;
    scrollToBottom();
  });
</script>

<div class="chat-container">
  <div class="messages" bind:this={messagesContainer}>
    {#if chatStore.messages.length === 0}
      <div class="empty-state">
        <h2>🌐 WorldMirror</h2>
        <p>Start a conversation by typing a message below.</p>
      </div>
    {:else}
      {#each chatStore.messages as message (message.id)}
        <div class="message message-{message.role}" class:streaming={message.streaming}>
          <div class="message-role">
            {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
          </div>
          <div class="message-content">
            {message.content}
            {#if message.streaming}
              <span class="cursor">▊</span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  {#if chatStore.error}
    <div class="error-panel">
      ⚠️ {chatStore.error}
    </div>
  {/if}

  <div class="composer">
    <textarea
      bind:value={inputValue}
      onkeydown={handleKeydown}
      placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
      disabled={chatStore.isStreaming}
      rows="2"
    ></textarea>
    <button
      onclick={handleSend}
      disabled={chatStore.isStreaming || !inputValue.trim()}
    >
      {chatStore.isStreaming ? '⏳' : '➤'}
    </button>
    <button onclick={() => chatStore.clearChat()} class="clear-btn" title="Clear chat">
      🗑️
    </button>
  </div>
</div>

<style>
  .chat-container {
    display: flex;
    flex-direction: column;
    flex: 1;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
    height: calc(100vh - 60px);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    color: #666;
  }

  .empty-state h2 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .message {
    padding: 0.75rem 1rem;
    border-radius: 12px;
    max-width: 80%;
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message-user {
    align-self: flex-end;
    background: #2a3a5c;
    border-bottom-right-radius: 4px;
  }

  .message-assistant {
    align-self: flex-start;
    background: #1e1e2e;
    border: 1px solid #2a2a3e;
    border-bottom-left-radius: 4px;
  }

  .message-role {
    font-size: 0.75rem;
    color: #888;
    margin-bottom: 0.25rem;
  }

  .message-content {
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .cursor {
    animation: blink 0.8s infinite;
    color: #6688cc;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  .streaming {
    opacity: 0.95;
  }

  .error-panel {
    padding: 0.5rem 1rem;
    background: #3a1a1a;
    color: #ff8888;
    font-size: 0.85rem;
    border-top: 1px solid #4a2a2a;
  }

  .composer {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #1a1a2e;
    border-top: 1px solid #2a2a3e;
    align-items: flex-end;
  }

  .composer textarea {
    flex: 1;
    background: #0f0f1f;
    border: 1px solid #2a2a3e;
    color: #e0e0e0;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
    resize: none;
    outline: none;
    transition: border-color 0.2s;
  }

  .composer textarea:focus {
    border-color: #4a4a8a;
  }

  .composer textarea:disabled {
    opacity: 0.5;
  }

  .composer button {
    background: #2a3a5c;
    border: none;
    color: #c0c0ff;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.1rem;
    transition: background 0.2s;
    height: fit-content;
  }

  .composer button:hover:not(:disabled) {
    background: #3a4a6c;
  }

  .composer button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .clear-btn {
    background: #2a2a3e !important;
    font-size: 0.9rem !important;
    padding: 0.5rem 0.75rem !important;
  }
</style>
