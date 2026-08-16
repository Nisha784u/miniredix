import type { Plugin, ViteDevServer } from 'vite';
import { createTcpServer } from '../engine/TcpServer.js';
import { db, createApiApp } from './app.js';

/**
 * Vite dev-server plugin. Mounts the shared Express API (src/server/app.ts)
 * as middleware and starts the local TCP server. This is local-development
 * only — the production deployment on Vercel uses the same `createApiApp()`
 * factory from a serverless function instead (see api/[...path].ts).
 */
export function miniRedisServerPlugin(): Plugin {
  let tcpServerStarted = false;

  return {
    name: 'miniredix-server',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      // Start TCP server once (local dev only)
      if (!tcpServerStarted) {
        tcpServerStarted = true;
        createTcpServer(db, { port: 6399 });
      }

      server.middlewares.use(createApiApp());
    },
  };
}
