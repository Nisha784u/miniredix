# MiniRedix

A compact, Redis-inspired in-memory key-value store with a built-in REST API, TCP server, and a React dashboard for browsing and managing data.

## Project Highlights

- **Custom Redis-inspired engine** — in-memory key-value store written from scratch in TypeScript
- **TTL / expiration** — per-key expiry with lazy deletion and background purging
- **AOF persistence & restart recovery** — append-only file logs every mutating command; state is replayed on startup
- **REST API** — Express endpoints for commands, key management, stats, and history
- **TCP server** — line-based protocol compatible with raw socket clients (e.g. `telnet`, `nc`)
- **React dashboard** — browse keys, run commands, view stats, and explore command history
- **Automated testing** — unit tests for the engine, persistence, recovery, and end-to-end HTTP/TCP tests

## Key Features

- 12 supported commands (SET, GET, DEL, EXISTS, KEYS, FLUSHALL, EXPIRE, TTL, PERSIST, TYPE, RENAME, INFO)
- Quoted-string parsing for values containing spaces
- Glob pattern matching for KEYS (`*` and `?` wildcards)
- Append-only file persistence with compaction support
- Rate-limited REST API (300 requests/minute)
- Input size limits and command validation on both REST and TCP interfaces
- Real-time stats dashboard with auto-refresh

## Tech Stack

- **TypeScript** — engine, server, and frontend
- **React 18 + React Router** — dashboard UI
- **Vite 6** — dev server and build tool
- **Express 4** — REST API
- **Node.js `net`** — TCP server
- **Tailwind CSS 3** — styling
- **Vitest** — test framework

## Architecture

```
┌─────────────────────────────────────────┐
│  React Dashboard (Vite + Tailwind)      │
│  Overview / Console / Keys / Stats      │
└──────────────┬──────────────────────────┘
               │ HTTP (fetch)
┌──────────────▼──────────────────────────┐
│  Express REST API  (port 5173)          │
│  /api/command /api/keys /api/stats ...   │
└──────────────┬──────────────────────────┘
               │ shared instance
┌──────────────▼──────────────────────────┐
│  MiniRedix Engine                       │
│  Parser → Executor → In-memory store    │
└──────────────┬──────────────────────────┘
               │
      ┌────────┴─────────┐
      ▼                  ▼
┌──────────┐     ┌──────────────┐
│ TCP Server│     │ Persistence  │
│ (port 6399)     │ (.data/AOF)  │
└──────────┘     └──────────────┘
```

The REST API and TCP server share a single engine instance, so data written through one interface is immediately visible through the other.

## Supported Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| SET | `SET key value [seconds]` | Store a string value with optional TTL |
| GET | `GET key` | Retrieve a value (returns `(nil)` if missing) |
| DEL | `DEL key [key ...]` | Delete keys, returns count removed |
| EXISTS | `EXISTS key [key ...]` | Check key existence, returns count |
| KEYS | `KEYS [pattern]` | List keys matching glob pattern |
| FLUSHALL | `FLUSHALL` | Delete all keys |
| EXPIRE | `EXPIRE key seconds` | Set TTL on a key |
| TTL | `TTL key` | Show remaining TTL (-1 = no expiry, -2 = missing) |
| PERSIST | `PERSIST key` | Remove TTL from a key |
| TYPE | `TYPE key` | Show data type (always "string") |
| RENAME | `RENAME key newkey` | Rename a key |
| INFO | `INFO` | Display server stats |

## Local Setup

```bash
npm install
npm run dev
```

The dashboard is available at `http://localhost:5173`. The TCP server listens on port `6399` and accepts plain-text commands:

```bash
nc 127.0.0.1 6399
SET greeting "Hello, World!"
GET greeting
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |

### Security Note

**Never commit real credentials to the repository.** All secrets must stay in environment variables via `.env`, which is gitignored. The `.env.example` file contains only placeholder values and is safe to commit. Do not put API keys, database passwords, JWT secrets, or private tokens in any tracked file.

## Build

```bash
npm run build      # production build to dist/
npm run preview    # preview the production build
```

## How to Run Tests

```bash
npm test            # run all tests once
npm run test:watch  # run in watch mode
```

The test suite covers:
- Engine logic (31 tests)
- Command parsing and execution (33 tests)
- AOF persistence (7 tests)
- Crash recovery and replay (7 tests)
- End-to-end REST API and TCP integration (16 tests)

## Project Structure

```
src/
├── engine/
│   ├── MiniRedis.ts        # In-memory store with TTL
│   ├── CommandParser.ts     # Tokenizer + validation
│   ├── CommandExecutor.ts   # Command dispatch
│   ├── Persistence.ts       # AOF read/write/replay
│   ├── TcpServer.ts         # Line-based TCP protocol
│   └── types.ts             # Shared interfaces
├── server/
│   └── plugin.ts            # Express REST API + Vite plugin
├── pages/                   # React dashboard pages
├── components/              # Shared UI components
└── lib/                     # API client + utilities
tests/
├── engine.test.ts           # Engine unit tests
├── commands.test.ts         # Command tests
├── persistence.test.ts      # AOF tests
├── recovery.test.ts         # Restart recovery tests
├── verify-recovery.test.ts  # Recovery verification
└── e2e-real.test.ts         # HTTP + TCP integration tests
```

## Persistence

Every mutating command (SET, DEL, EXPIRE, FLUSHALL, PERSIST, RENAME) is appended as a JSON line to `.data/miniredis.aof`. On startup, the file is replayed to reconstruct in-memory state. The AOF can be compacted via the dashboard or `POST /api/compact` to rewrite it with only the current snapshot.

## REST API & TCP

**REST API** (port 5173):
- `POST /api/command` — execute any supported command
- `GET /api/keys?pattern=*` — list keys with metadata
- `GET /api/key/:key` — get key detail
- `DELETE /api/key/:key` — delete a key
- `GET /api/stats` — engine statistics
- `GET /api/history` — recent command history
- `GET /api/health` — health check
- `POST /api/compact` — compact the AOF

**TCP Server** (port 6399):
- Line-based plain-text protocol
- Same command set as the REST API
- Connect with `nc 127.0.0.1 6399` or any TCP client
