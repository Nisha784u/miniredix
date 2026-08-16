import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../src/server/app.js';

/**
 * Single Vercel serverless function that handles every /api/* request
 * (see vercel.json — there is no per-route function file). Routing to the
 * correct handler (/api/command, /api/keys, /api/key/:key, etc.) happens
 * inside the shared Express app itself, exactly as it does for the Vite
 * dev server.
 *
 * Keeping all routes in one function means they share the same in-memory
 * MiniRedis instance for the lifetime of the warm serverless container —
 * see README "Persistence" section for what this does and doesn't guarantee.
 */
const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  app(req, res);
}
