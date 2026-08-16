# MiniRedix

A compact Redis-inspired key-value store with a REST API, TCP server, and web dashboard.

## Live Demo
https://miniredix.vercel.app/

## Overview

MiniRedix stores string values in memory and exposes them through a simple command interface. The project includes a browser dashboard for exploring keys, running commands, reviewing history, and monitoring runtime statistics. Mutating commands are persisted to an append-only file so data can be recovered after a restart.

## Screenshots

<p align="center">
  <img src="screenshots/overview.png" alt="MiniRedix overview dashboard" width="49%" />
  <img src="screenshots/console.png" alt="MiniRedix command console" width="49%" />
</p>
<p align="center">
  <img src="screenshots/keys.png" alt="MiniRedix key explorer" width="49%" />
  <img src="screenshots/stats.png" alt="MiniRedix statistics" width="49%" />
</p>

## Features

- Redis-inspired commands for string values: `SET`, `GET`, `DEL`, `EXISTS`, `KEYS`, `FLUSHALL`, `EXPIRE`, `TTL`, `PERSIST`, `TYPE`, `RENAME`, and `INFO`
- Optional per-key expiration with lazy cleanup
- Append-only file persistence with restart recovery and compaction
- REST API for commands, key management, statistics, health, and history
- Line-based TCP protocol for raw socket clients
- React dashboard with command console, key explorer, history, documentation, and live metrics
- Input validation and rate limiting on the REST API
- Automated unit, persistence, recovery, and HTTP/TCP integration tests

## Tech stack

- TypeScript
- React 18 and React Router
- Vite
- Tailwind CSS
- Express
- Node.js `net`
- Vitest

## Deploying to Vercel

The dashboard and API both deploy as a single Vercel project:

- The React app builds normally via Vite (`framework: vite` in `vercel.json`).
- All `/api/*` requests are handled by one serverless function, `api/[...path].ts`, which mounts the same Express app (`src/server/app.ts`) used by the local dev server — so the exact same MiniRedix engine, command parser, and routes run in both places.
- `vercel.json` rewrites non-`/api` paths to `index.html` so client-side routes (e.g. `/keys/some-key`) don't 404 on a hard refresh.

No environment variables or configuration are required — just import the repo into Vercel and deploy.

### Persistence on Vercel

Vercel serverless functions do not provide a reliable, persistent filesystem: the deployment's filesystem is read-only (aside from `/tmp`, which is ephemeral and not shared across invocations), and each function may run in a fresh container at any time. Because of this, **the append-only file (AOF) persistence used locally is disabled in the Vercel deployment**, and the store falls back to plain in-memory state:

- Data set via the Console (or the REST API) will remain available for as long as the same warm serverless container keeps handling requests.
- A cold start — which can happen at any time, e.g. after a period of inactivity or a new deployment — resets the store.
- This is a known, accepted limitation for this first deployment, not a bug. Nothing pretends to persist data that isn't actually being persisted; there is no writing to `/tmp` or similar to simulate durability.

Local development (`npm run dev`) is unaffected: it still uses the on-disk AOF file under `.data/` exactly as before, with full restart recovery and compaction.

If durable persistence in production is needed later, the natural next step is to swap the in-memory `MiniRedis` store for an external store (e.g. Redis, Vercel KV, or a hosted database) behind the same engine interface — no changes to the REST API or frontend would be required.

## Run locally

```bash
npm install
npm run dev
```

The dashboard is available at `http://localhost:5173`. The TCP server listens on port `6399`.

Run the production build with:

```bash
npm run build
```

Run the test suite with:

```bash
npm test
```

## Project structure

```text
src/
├── components/   Shared dashboard UI
├── engine/       Store, command handling, persistence, and TCP server
├── lib/          API client and formatting utilities
├── pages/        Dashboard views
└── server/       Express API and Vite integration

tests/             Unit and integration tests
screenshots/       README screenshots of the dashboard
```
