/**
 * Chunkers — Split text into chunks for embedding and retrieval
 * 
 * Two strategies:
 * 1. Token-window chunker: fixed size with overlap
 * 2. Markdown-aware chunker: split on headings and sections
 */

import type { Chunk, ChunkOptions } from '@chatbot/types';

/**
 * Estimate token count using word-based heuristic (~1.3 tokens per word).
 * Matches the estimator in @chatbot/core tokenBudget.ts.
 */
export function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return Math.ceil(words.length * 1.3);
}

/**
 * Token-window chunker: splits text into fixed-size chunks with overlap.
 * Default: 800 tokens, 120 overlap.
 */
export function chunkByTokenWindow(
  text: string,
  options: Partial<ChunkOptions> = {}
): Chunk[] {
  const maxTokens = options.maxTokens ?? 800;
  const overlap = options.overlap ?? 120;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  // Approximate words per chunk based on token estimate
  const wordsPerToken = 1 / 1.3;
  const maxWords = Math.floor(maxTokens * wordsPerToken);
  const overlapWords = Math.floor(overlap * wordsPerToken);

  if (maxWords <= 0) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWords, words.length);
    const chunkWords = words.slice(start, end);
    const content = chunkWords.join(' ');
    const tokenCount = estimateTokenCount(content);

    chunks.push({
      content,
      index,
      tokenCount,
      metadata: {
        strategy: 'token_window',
        wordStart: start,
        wordEnd: end,
      },
    });

    index++;

    // Move forward by (maxWords - overlapWords) to create overlap
    const step = Math.max(1, maxWords - overlapWords);
    start += step;

    // If remaining words fit in one chunk, don't create a tiny last chunk
    if (start < words.length && words.length - start < overlapWords) {
      const remainingContent = words.slice(start).join(' ');
      const remainingTokens = estimateTokenCount(remainingContent);
      chunks.push({
        content: remainingContent,
        index,
        tokenCount: remainingTokens,
        metadata: {
          strategy: 'token_window',
          wordStart: start,
          wordEnd: words.length,
        },
      });
      break;
    }
  }

  return chunks;
}

/**
 * Markdown-aware chunker: splits on headings while preserving structure.
 * Respects code blocks and keeps heading context.
 */
export function chunkByMarkdown(
  text: string,
  options: Partial<ChunkOptions> = {}
): Chunk[] {
  const maxTokens = options.maxTokens ?? 800;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const lines = text.split('\n');
  const sections: { heading: string; content: string }[] = [];
  let currentHeading = '';
  let currentLines: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    // Track code block state
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      currentLines.push(line);
      continue;
    }

    // Only split on headings outside code blocks
    if (!inCodeBlock && /^#{1,6}\s/.test(line)) {
      // Save previous section
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentLines.join('\n'),
        });
      }
      currentHeading = line;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Push final section
  if (currentLines.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentLines.join('\n'),
    });
  }

  // Now merge small sections and split large ones
  const chunks: Chunk[] = [];
  let index = 0;
  let buffer = '';
  let bufferHeading = '';

  for (const section of sections) {
    const sectionTokens = estimateTokenCount(section.content);

    if (sectionTokens > maxTokens) {
      // Flush buffer first
      if (buffer.trim()) {
        chunks.push({
          content: buffer.trim(),
          index,
          tokenCount: estimateTokenCount(buffer),
          metadata: {
            strategy: 'markdown',
            heading: bufferHeading,
          },
        });
        index++;
        buffer = '';
        bufferHeading = '';
      }

      // Split large section using token-window chunker
      const subChunks = chunkByTokenWindow(section.content, {
        maxTokens,
        overlap: options.overlap ?? 120,
      });
      for (const sub of subChunks) {
        chunks.push({
          content: sub.content,
          index,
          tokenCount: sub.tokenCount,
          metadata: {
            strategy: 'markdown',
            heading: section.heading,
            subChunk: true,
          },
        });
        index++;
      }
    } else {
      const combined = buffer ? `${buffer}\n\n${section.content}` : section.content;
      const combinedTokens = estimateTokenCount(combined);

      if (combinedTokens > maxTokens) {
        // Flush buffer
        if (buffer.trim()) {
          chunks.push({
            content: buffer.trim(),
            index,
            tokenCount: estimateTokenCount(buffer),
            metadata: {
              strategy: 'markdown',
              heading: bufferHeading,
            },
          });
          index++;
        }
        buffer = section.content;
        bufferHeading = section.heading;
      } else {
        buffer = combined;
        if (!bufferHeading) bufferHeading = section.heading;
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    chunks.push({
      content: buffer.trim(),
      index,
      tokenCount: estimateTokenCount(buffer),
      metadata: {
        strategy: 'markdown',
        heading: bufferHeading,
      },
    });
  }

  return chunks;
}

/**
 * Auto-select chunking strategy based on content type.
 */
export function chunk(
  text: string,
  options: Partial<ChunkOptions> = {}
): Chunk[] {
  const strategy = options.strategy ?? detectStrategy(text);

  switch (strategy) {
    case 'markdown':
      return chunkByMarkdown(text, options);
    case 'token_window':
    default:
      return chunkByTokenWindow(text, options);
  }
}

/**
 * Detect whether text is markdown (has headings) or plain text.
 */
function detectStrategy(text: string): 'markdown' | 'token_window' {
  const headingPattern = /^#{1,6}\s/m;
  return headingPattern.test(text) ? 'markdown' : 'token_window';
}
