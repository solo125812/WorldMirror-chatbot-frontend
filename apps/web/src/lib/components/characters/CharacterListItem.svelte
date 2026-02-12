<script lang="ts">
  /**
   * CharacterListItem — Single character row with avatar and name
   */

  interface Props {
    character: {
      id: string;
      name: string;
      avatar: string | null;
      description: string;
      tags: string[];
    };
    selected?: boolean;
    onclick?: () => void;
  }

  let { character, selected = false, onclick }: Props = $props();
</script>

<button
  class="character-item"
  class:selected
  onclick={onclick}
  title={character.description}
>
  <div class="avatar">
    {#if character.avatar}
      <img src={character.avatar} alt={character.name} />
    {:else}
      <span class="avatar-placeholder">{character.name.charAt(0).toUpperCase()}</span>
    {/if}
  </div>
  <div class="info">
    <span class="name">{character.name}</span>
    {#if character.tags.length > 0}
      <div class="tags">
        {#each character.tags.slice(0, 3) as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>
</button>

<style>
  .character-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    color: #e0e0e0;
    text-align: left;
    transition: all 0.15s;
    font-family: inherit;
  }

  .character-item:hover {
    background: #1e1e2e;
    border-color: #2a2a3e;
  }

  .character-item.selected {
    background: #2a3a5c;
    border-color: #4a5a8c;
  }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #2a2a3e;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    font-size: 1rem;
    color: #8888cc;
    font-weight: 600;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    overflow: hidden;
  }

  .name {
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tags {
    display: flex;
    gap: 0.25rem;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  .tag {
    font-size: 0.65rem;
    background: #2a2a3e;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    color: #8888cc;
    white-space: nowrap;
  }
</style>
