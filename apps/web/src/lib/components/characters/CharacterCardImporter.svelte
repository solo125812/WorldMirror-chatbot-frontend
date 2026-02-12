<script lang="ts">
  /**
   * CharacterCardImporter — Drag-and-drop JSON/PNG import
   */

  interface Props {
    onimport?: (file: File) => void;
  }

  let { onimport }: Props = $props();

  let isDragging = $state(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) onimport?.(file);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave() {
    isDragging = false;
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) onimport?.(file);
    input.value = '';
  }
</script>

<div
  class="importer"
  class:dragging={isDragging}
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  role="button"
  tabindex="0"
>
  <div class="icon">📥</div>
  <p>Drop a character card here</p>
  <p class="hint">.json or .png</p>
  <label class="file-label">
    Or browse files
    <input type="file" accept=".json,.png" onchange={handleFileSelect} />
  </label>
</div>

<style>
  .importer {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    border: 2px dashed #2a2a3e;
    border-radius: 12px;
    background: #0f0f1f;
    transition: all 0.2s;
    gap: 0.5rem;
    cursor: pointer;
  }

  .importer.dragging {
    border-color: #6688cc;
    background: #1a1a3e;
  }

  .icon {
    font-size: 2rem;
    margin-bottom: 0.25rem;
  }

  p {
    color: #888;
    font-size: 0.85rem;
    margin: 0;
  }

  .hint {
    font-size: 0.75rem;
    color: #666;
  }

  .file-label {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: #6688cc;
    cursor: pointer;
    text-decoration: underline;
  }

  .file-label input {
    display: none;
  }
</style>
