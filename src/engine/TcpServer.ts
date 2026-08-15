/**
 * TCP server implementing a simple line-based Redis-style protocol.
 *
 * Protocol: send a command as a plain text line terminated by \r\n or \n.
 * The server responds with the result followed by \r\n.
 *
 * Example session:
 *   Client: SET name Nisha\r\n
 *   Server: OK\r\n
 *   Client: GET name\r\n
 *   Server: Nisha\r\n
 */
import net from 'net';
import { MiniRedis } from './MiniRedis.js';
import { executeCommand } from './CommandExecutor.js';

export interface TcpServerOptions {
  port?: number;
  host?: string;
  maxConnections?: number;
}

const MAX_LINE_LENGTH = 8192;
const MAX_BUFFER_LENGTH = 65536;

export function createTcpServer(db: MiniRedis, options: TcpServerOptions = {}): net.Server {
  const { port = 6399, host = '127.0.0.1', maxConnections = 10 } = options;

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    socket.write('MiniRedix 1.0.0 — type a command and press Enter\r\n');

    let buffer = '';

    socket.on('data', (chunk: string) => {
      buffer += chunk;

      if (buffer.length > MAX_BUFFER_LENGTH) {
        socket.write('ERR input too long\r\n');
        socket.end();
        return;
      }

      const lines = buffer.split(/\r?\n/);
      // Last element may be incomplete; save it
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.length > MAX_LINE_LENGTH) {
          socket.write('ERR command too long\r\n');
          continue;
        }
        if (trimmed.toLowerCase() === 'quit' || trimmed.toLowerCase() === 'exit') {
          socket.write('Goodbye\r\n');
          socket.end();
          return;
        }
        const { success, result, error } = executeCommand(db, trimmed);
        const response = success ? (result ?? 'OK') : (error ?? 'ERR');
        socket.write(response + '\r\n');
      }
    });

    socket.on('error', () => socket.destroy());
  });

  server.maxConnections = maxConnections;

  server.listen(port, host, () => {
    console.log(`[MiniRedix TCP] Listening on ${host}:${port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MiniRedix TCP] Port ${port} already in use, TCP server disabled`);
    } else {
      console.error('[MiniRedix TCP] Error:', err.message);
    }
  });

  return server;
}
