/**
 * Code chunker — §10.2 Chunking Rules, §10.4
 *
 * Splits source code files into chunks suitable for embedding.
 * Uses a line-based approach with language-aware splitting
 * (tree-sitter integration deferred until dependencies are added).
 */

import type { CreateCodeChunkPayload } from '@chatbot/types';
import { hashFile } from './scanner.js';

/** Chunking configuration */
export interface ChunkConfig {
  maxLines: number;
  minLines: number;
  overlapLines: number;
}

const DEFAULT_CONFIG: ChunkConfig = {
  maxLines: 200,
  minLines: 5,
  overlapLines: 20,
};

/**
 * Split source code into chunks using a line-based approach.
 *
 * This is the fallback chunker that works for all languages.
 * It splits on natural boundaries (blank lines, function-like patterns)
 * and enforces max/min line constraints.
 */
export function chunkCode(
  content: string,
  filePath: string,
  language: string,
  documentId: string,
  workspacePath: string,
  fileHash: string,
  config: Partial<ChunkConfig> = {},
): CreateCodeChunkPayload[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const lines = content.split('\n');

  if (lines.length <= cfg.maxLines) {
    // Small file — single chunk
    if (lines.length < cfg.minLines) return [];
    return [{
      documentId,
      workspacePath,
      filePath,
      language,
      content,
      lineStart: 1,
      lineEnd: lines.length,
      hash: hashFile(content),
      fileHash,
    }];
  }

  const chunks: CreateCodeChunkPayload[] = [];
  let chunkStart = 0;

  while (chunkStart < lines.length) {
    let chunkEnd = Math.min(chunkStart + cfg.maxLines, lines.length);

    // Try to find a natural break point near the end of the chunk
    if (chunkEnd < lines.length) {
      const searchStart = Math.max(chunkStart + cfg.minLines, chunkEnd - 30);
      let bestBreak = chunkEnd;

      for (let i = chunkEnd - 1; i >= searchStart; i--) {
        const line = lines[i]?.trim() ?? '';
        // Good break points: blank lines, closing braces, end of blocks
        if (line === '' || line === '}' || line === '};' || line === 'end' || line === '})') {
          bestBreak = i + 1;
          break;
        }
      }

      chunkEnd = bestBreak;
    }

    const chunkLines = lines.slice(chunkStart, chunkEnd);
    const chunkContent = chunkLines.join('\n');

    if (chunkLines.length >= cfg.minLines) {
      chunks.push({
        documentId,
        workspacePath,
        filePath,
        language,
        content: chunkContent,
        lineStart: chunkStart + 1,
        lineEnd: chunkEnd,
        hash: hashFile(chunkContent),
        fileHash,
      });
    }

    // Advance with overlap
    chunkStart = chunkEnd - cfg.overlapLines;
    if (chunkStart <= (chunks.length > 0 ? (chunks[chunks.length - 1]!.lineStart - 1 + cfg.overlapLines) : 0)) {
      chunkStart = chunkEnd;
    }
  }

  return chunks;
}

/**
 * Chunk a file, choosing the best strategy based on language.
 * Currently uses line-based chunking for all languages.
 * Tree-sitter AST chunking can be added later for supported languages.
 */
export function chunkFile(
  content: string,
  filePath: string,
  language: string,
  documentId: string,
  workspacePath: string,
  fileHash: string,
  config?: Partial<ChunkConfig>,
): CreateCodeChunkPayload[] {
  // In the future, we can dispatch to language-specific chunkers here
  // e.g. if (hasTreeSitter(language)) return treeSitterChunk(...)
  return chunkCode(content, filePath, language, documentId, workspacePath, fileHash, config);
}
