<script lang="ts">
  /**
   * CharacterEditor — Full edit form for a character
   */

  interface Props {
    character?: {
      id?: string;
      name: string;
      description: string;
      personality: string;
      scenario: string;
      firstMessage: string;
      exampleMessages: string;
      systemPrompt: string;
      postHistoryInstructions: string;
      creatorNotes: string;
      tags: string[];
      avatar: string | null;
      alternateGreetings: string[];
    };
    onsave?: (data: Record<string, unknown>) => void;
    oncancel?: () => void;
  }

  let { character, onsave, oncancel }: Props = $props();

  let form = $state({
    name: character?.name ?? '',
    description: character?.description ?? '',
    personality: character?.personality ?? '',
    scenario: character?.scenario ?? '',
    firstMessage: character?.firstMessage ?? '',
    exampleMessages: character?.exampleMessages ?? '',
    systemPrompt: character?.systemPrompt ?? '',
    postHistoryInstructions: character?.postHistoryInstructions ?? '',
    creatorNotes: character?.creatorNotes ?? '',
    tagsInput: character?.tags?.join(', ') ?? '',
    alternateGreetings: [...(character?.alternateGreetings ?? [])],
  });

  function handleSave() {
    onsave?.({
      name: form.name,
      description: form.description,
      personality: form.personality,
      scenario: form.scenario,
      firstMessage: form.firstMessage,
      exampleMessages: form.exampleMessages,
      systemPrompt: form.systemPrompt,
      postHistoryInstructions: form.postHistoryInstructions,
      creatorNotes: form.creatorNotes,
      tags: form.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      alternateGreetings: form.alternateGreetings.filter(Boolean),
    });
  }

  function addGreeting() {
    form.alternateGreetings = [...form.alternateGreetings, ''];
  }

  function removeGreeting(index: number) {
    form.alternateGreetings = form.alternateGreetings.filter((_, i) => i !== index);
  }
</script>

<div class="editor">
  <div class="editor-header">
    <h3>{character?.id ? 'Edit Character' : 'New Character'}</h3>
    <div class="header-actions">
      <button class="btn-secondary" onclick={oncancel}>Cancel</button>
      <button class="btn-primary" onclick={handleSave} disabled={!form.name.trim()}>Save</button>
    </div>
  </div>

  <div class="editor-body">
    <div class="field">
      <label for="char-name">Name *</label>
      <input id="char-name" type="text" bind:value={form.name} placeholder="Character name" />
    </div>

    <div class="field">
      <label for="char-desc">Description</label>
      <textarea id="char-desc" bind:value={form.description} rows="3" placeholder="Character description..."></textarea>
    </div>

    <div class="field">
      <label for="char-personality">Personality</label>
      <textarea id="char-personality" bind:value={form.personality} rows="3" placeholder="Personality traits..."></textarea>
    </div>

    <div class="field">
      <label for="char-scenario">Scenario</label>
      <textarea id="char-scenario" bind:value={form.scenario} rows="3" placeholder="Chat scenario context..."></textarea>
    </div>

    <div class="field">
      <label for="char-sysprompt">System Prompt</label>
      <textarea id="char-sysprompt" bind:value={form.systemPrompt} rows="3" placeholder="System prompt override..."></textarea>
    </div>

    <div class="field">
      <label for="char-firstmsg">First Message</label>
      <textarea id="char-firstmsg" bind:value={form.firstMessage} rows="4" placeholder="Character's opening message..."></textarea>
    </div>

    <div class="field">
      <label for="char-examples">Example Messages</label>
      <textarea id="char-examples" bind:value={form.exampleMessages} rows="4" placeholder="Example conversation..."></textarea>
    </div>

    <div class="field">
      <label for="char-posthistory">Post-History Instructions</label>
      <textarea id="char-posthistory" bind:value={form.postHistoryInstructions} rows="2" placeholder="Injected after conversation history..."></textarea>
    </div>

    <div class="field">
      <label for="char-tags">Tags (comma-separated)</label>
      <input id="char-tags" type="text" bind:value={form.tagsInput} placeholder="fantasy, roleplay, ..." />
    </div>

    <div class="field">
      <label for="char-notes">Creator Notes</label>
      <textarea id="char-notes" bind:value={form.creatorNotes} rows="2" placeholder="Notes for other users..."></textarea>
    </div>

    <div class="field">
      <label>Alternate Greetings</label>
      {#each form.alternateGreetings as greeting, i}
        <div class="greeting-row">
          <textarea
            bind:value={form.alternateGreetings[i]}
            rows="2"
            placeholder="Alternate greeting {i + 1}..."
          ></textarea>
          <button class="btn-remove" onclick={() => removeGreeting(i)}>✕</button>
        </div>
      {/each}
      <button class="btn-add" onclick={addGreeting}>+ Add Greeting</button>
    </div>
  </div>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #141428;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #2a2a3e;
  }

  .editor-header h3 {
    margin: 0;
    font-size: 1rem;
    color: #c0c0e0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .editor-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .field label {
    font-size: 0.8rem;
    color: #8888aa;
    font-weight: 500;
  }

  .field input,
  .field textarea {
    background: #0f0f1f;
    border: 1px solid #2a2a3e;
    color: #e0e0e0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
    resize: vertical;
  }

  .field input:focus,
  .field textarea:focus {
    border-color: #4a4a8a;
  }

  .greeting-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .greeting-row textarea {
    flex: 1;
    background: #0f0f1f;
    border: 1px solid #2a2a3e;
    color: #e0e0e0;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    resize: vertical;
  }

  .btn-primary {
    background: #2a5c3a;
    border: none;
    color: #c0ffc0;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s;
  }

  .btn-primary:hover:not(:disabled) { background: #3a6c4a; }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-secondary {
    background: #2a2a3e;
    border: none;
    color: #c0c0e0;
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.15s;
  }

  .btn-secondary:hover { background: #3a3a4e; }

  .btn-remove {
    background: #3a1a1a;
    border: none;
    color: #ff8888;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .btn-add {
    background: transparent;
    border: 1px dashed #2a2a3e;
    color: #6688cc;
    padding: 0.4rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.15s;
  }

  .btn-add:hover {
    border-color: #4a4a8a;
    background: #1a1a2e;
  }
</style>
