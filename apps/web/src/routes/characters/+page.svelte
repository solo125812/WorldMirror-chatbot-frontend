<script lang="ts">
  /**
   * Characters management page
   */
  import CharacterPanel from '$lib/components/characters/CharacterPanel.svelte';
  import CharacterEditor from '$lib/components/characters/CharacterEditor.svelte';
  import CharacterCardImporter from '$lib/components/characters/CharacterCardImporter.svelte';

  interface Character {
    id: string;
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
  }

  let characters = $state<Character[]>([]);
  let selectedId = $state<string | null>(null);
  let editingCharacter = $state<Character | null>(null);
  let showEditor = $state(false);
  let showImporter = $state(false);

  const API = '/api';

  async function loadCharacters() {
    try {
      const res = await fetch(`${API}/characters`);
      const data = await res.json();
      characters = data.characters ?? [];
    } catch (err) {
      console.error('Failed to load characters', err);
    }
  }

  function handleSelect(id: string) {
    selectedId = id;
    const char = characters.find(c => c.id === id);
    if (char) {
      editingCharacter = char;
      showEditor = true;
      showImporter = false;
    }
  }

  function handleCreate() {
    editingCharacter = null;
    showEditor = true;
    showImporter = false;
  }

  async function handleSave(data: Record<string, unknown>) {
    try {
      if (editingCharacter?.id) {
        await fetch(`${API}/characters/${editingCharacter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${API}/characters`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      showEditor = false;
      editingCharacter = null;
      await loadCharacters();
    } catch (err) {
      console.error('Failed to save character', err);
    }
  }

  function handleCancel() {
    showEditor = false;
    editingCharacter = null;
  }

  async function handleImport(file: File) {
    try {
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const json = JSON.parse(text);
        await fetch(`${API}/characters/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        });
      } else {
        const formData = new FormData();
        formData.append('file', file);
        await fetch(`${API}/characters/import`, {
          method: 'POST',
          body: formData,
        });
      }
      showImporter = false;
      await loadCharacters();
    } catch (err) {
      console.error('Failed to import character', err);
    }
  }

  // Load on mount
  $effect(() => {
    loadCharacters();
  });
</script>

<div class="characters-page">
  <CharacterPanel
    {characters}
    {selectedId}
    onselect={handleSelect}
    oncreate={handleCreate}
  />

  <div class="main-area">
    {#if showEditor}
      <CharacterEditor
        character={editingCharacter ?? undefined}
        onsave={handleSave}
        oncancel={handleCancel}
      />
    {:else if showImporter}
      <CharacterCardImporter onimport={handleImport} />
    {:else}
      <div class="placeholder">
        <h2>📋 Characters</h2>
        <p>Select a character to edit, or create a new one.</p>
        <div class="actions">
          <button onclick={handleCreate}>Create Character</button>
          <button onclick={() => showImporter = true}>Import Card</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .characters-page {
    display: flex;
    height: calc(100vh - 60px);
  }

  .main-area {
    flex: 1;
    overflow-y: auto;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #666;
    gap: 1rem;
  }

  .placeholder h2 {
    font-size: 1.5rem;
    color: #888;
  }

  .actions {
    display: flex;
    gap: 0.75rem;
  }

  .actions button {
    background: #2a3a5c;
    border: none;
    color: #c0c0ff;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.15s;
  }

  .actions button:hover {
    background: #3a4a6c;
  }
</style>
