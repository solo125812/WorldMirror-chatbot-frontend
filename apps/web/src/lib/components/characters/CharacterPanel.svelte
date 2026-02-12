<script lang="ts">
  /**
   * CharacterPanel — Left rail character list with search
   */
  import CharacterListItem from './CharacterListItem.svelte';

  interface Character {
    id: string;
    name: string;
    avatar: string | null;
    description: string;
    tags: string[];
  }

  interface Props {
    characters?: Character[];
    selectedId?: string | null;
    onselect?: (id: string) => void;
    oncreate?: () => void;
  }

  let { characters = [], selectedId = null, onselect, oncreate }: Props = $props();

  let searchQuery = $state('');

  let filteredCharacters = $derived(
    searchQuery
      ? characters.filter(c =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : characters
  );
</script>

<div class="character-panel">
  <div class="panel-header">
    <h3>Characters</h3>
    <button class="create-btn" onclick={oncreate} title="Create character">+</button>
  </div>

  <div class="search-box">
    <input
      type="text"
      placeholder="Search characters..."
      bind:value={searchQuery}
    />
  </div>

  <div class="character-list">
    {#if filteredCharacters.length === 0}
      <div class="empty">
        {searchQuery ? 'No matches' : 'No characters yet'}
      </div>
    {:else}
      {#each filteredCharacters as character (character.id)}
        <CharacterListItem
          {character}
          selected={character.id === selectedId}
          onclick={() => onselect?.(character.id)}
        />
      {/each}
    {/if}
  </div>
</div>

<style>
  .character-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #121220;
    border-right: 1px solid #2a2a3e;
    width: 260px;
    flex-shrink: 0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #2a2a3e;
  }

  .panel-header h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #c0c0e0;
    margin: 0;
  }

  .create-btn {
    background: #2a3a5c;
    border: none;
    color: #c0c0ff;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .create-btn:hover {
    background: #3a4a6c;
  }

  .search-box {
    padding: 0.5rem 0.75rem;
  }

  .search-box input {
    width: 100%;
    background: #0f0f1f;
    border: 1px solid #2a2a3e;
    color: #e0e0e0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-box input:focus {
    border-color: #4a4a8a;
  }

  .character-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .empty {
    padding: 1.5rem;
    text-align: center;
    color: #666;
    font-size: 0.8rem;
  }
</style>
