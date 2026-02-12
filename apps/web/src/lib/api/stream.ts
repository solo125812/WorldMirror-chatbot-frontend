/**
 * SSE stream parser — reads Server-Sent Events from a fetch response
 */

export interface SSEEvent {
  type: string;
  data: string;
}

/**
 * Parse SSE events from a ReadableStream
 */
export async function* parseSSEStream(
  response: Response
): AsyncIterable<SSEEvent> {
  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines (SSE event separator)
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;

        let eventType = 'message';
        let data = '';

        for (const line of part.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.slice(6).trim();
          }
        }

        yield { type: eventType, data };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Stream chat from the server using SSE
 */
export async function streamChat(
  message: string,
  chatId?: string,
  onToken?: (token: string) => void,
  onDone?: (chatId: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, chatId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    onError?.(errorText || `HTTP ${response.status}`);
    return;
  }

  const responseChatId = response.headers.get('X-Chat-Id') ?? chatId ?? '';

  for await (const event of parseSSEStream(response)) {
    try {
      const parsed = JSON.parse(event.data);

      switch (event.type) {
        case 'token':
          onToken?.(parsed.value ?? '');
          break;
        case 'done':
          onDone?.(responseChatId);
          break;
        case 'error':
          onError?.(parsed.message ?? 'Unknown error');
          break;
      }
    } catch {
      // Skip malformed events
    }
  }
}
