import http, { type IncomingMessage, type ServerResponse } from 'node:http';

export interface RecordedRequest {
  method: string | undefined;
  url: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: any | null;
}

export type MockHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  record: RecordedRequest,
) => void | Promise<void>;

export class MockHttpServer {
  private server?: http.Server;
  private portValue?: number;
  private records: RecordedRequest[] = [];

  constructor(private handler: MockHandler) {}

  get url(): string {
    if (!this.portValue) throw new Error('Server not started');
    return `http://127.0.0.1:${this.portValue}`;
  }

  get lastRequest(): RecordedRequest | undefined {
    return this.records[this.records.length - 1];
  }

  async start(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let json: any | null = null;
      if (body.trim().length > 0) {
        try {
          json = JSON.parse(body);
        } catch {
          json = null;
        }
      }

      const record: RecordedRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
        json,
      };
      this.records.push(record);

      try {
        await this.handler(req, res, record);
      } catch {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Mock server error');
      }
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(0, '127.0.0.1', () => {
        const address = this.server!.address();
        if (address && typeof address === 'object') {
          this.portValue = address.port;
          resolve();
        } else {
          reject(new Error('Failed to resolve server address'));
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    this.server = undefined;
    this.portValue = undefined;
  }
}
