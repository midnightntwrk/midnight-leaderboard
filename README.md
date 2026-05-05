# Midnight Leaderboard

An arcade-style privacy-preserving leaderboard built on the [Midnight Network](https://midnight.network). Every score submission creates a new entry, just like an arcade cabinet. Players choose how their identity appears: anonymous, public wallet address, or custom display name. Prove ownership of your scores via ZK proofs without revealing your identity.

Live on Preprod: [midnight-leaderboard.vercel.app](https://midnight-leaderboard.vercel.app)

## What It Demonstrates

| Concept | What You Learn |
|---------|---------------|
| `Map<Uint<64>, ScoreEntry>` | Storing structured data on-chain with auto-incrementing keys |
| Privacy modes | Anonymous, public address, or custom name via conditional witness invocation |
| Witness functions | Private data (custom name) enters the ZK circuit on demand |
| Ownership verification | Prove you own an entry without revealing your identity |
| Browser DApp | Lace wallet integration, in-browser ZK proving, real-time indexer reads |
| Production deployment | Vercel (frontend) + Railway (proof server) |

## Tutorial

Follow the step-by-step tutorial in [tutorials/](./tutorials/) to rebuild this DApp from scratch. The tutorial covers the Compact smart contract, TypeScript integration, browser DApp with Lace wallet, and production deployment.

## Project Structure

```
midnight-leaderboard/
├── contract/                        # Compact smart contract
│   ├── leaderboard.compact          # Leaderboard with anonymous/custom names + verification
│   ├── src/
│   │   ├── index.ts                 # Exports CompiledLeaderboardContract + witnesses
│   │   └── witnesses.ts             # getCustomName witness (private data → ZK proof)
│   └── managed/                     # Compiler output (committed for Vercel builds)
├── api/                             # Shared business logic (platform-agnostic)
│   └── src/
│       ├── index.ts                 # LeaderboardAPI: deploy(), join(), submitScore(), verifyOwnership()
│       ├── common-types.ts          # Provider types, circuit keys, derived state
│       └── utils/index.ts           # decodeDisplayName with generated anonymous names
├── leaderboard-ui/                  # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx                  # Game UI + leaderboard + verification
│   │   ├── App.css                  # Midnight-branded dark theme
│   │   ├── main.tsx                 # Buffer polyfill + React mount
│   │   ├── contexts/
│   │   │   └── BrowserLeaderboardManager.ts  # Lace wallet → providers bridge
│   │   ├── hooks/
│   │   │   └── useLeaderboard.ts    # Read-only indexer queries (no wallet needed)
│   │   └── in-memory-private-state-provider.ts
│   ├── .env.preprod                 # Production config (Railway proof server URL)
│   └── vite.config.ts               # WASM plugins for compact-runtime in browser
├── tutorials/                       # Step-by-step build tutorial
├── proof-server/                    # Railway deployment
│   └── Dockerfile                   # Midnight proof server image
├── vercel.json                      # Vercel build config
└── package.json                     # Workspaces: contract, api, leaderboard-ui
```

## Prerequisites

- [Node.js v22+](https://nodejs.org/) (via `nvm use 22`)
- [Compact toolchain](https://docs.midnight.network/getting-started/installation#install-compact)
- [Lace wallet](https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk) browser extension
- [Docker](https://docs.docker.com/desktop/) (for local proof server)

## Quick Start

### 1. Install, compile, and build

```bash
nvm use 22
npm install
npm run compile
npm run build
```

### 2. Start the proof server

```bash
docker run -d -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server --network preprod
```

### 3. Start the UI

```bash
cd leaderboard-ui
npm run dev
```

Open `http://localhost:3000` in Chrome with Lace installed.

### 4. Play

1. The leaderboard loads immediately from the indexer (no wallet needed to view)
2. Connect your Lace wallet to submit scores
3. Click **Switch Contract** then **Deploy New** to deploy your own leaderboard
4. Play the click challenge
5. Submit your score as Anonymous, Public, or Custom
6. Click "Prove" on any entry to verify ownership via ZK proof

## Contract

### Privacy Modes

| Mode | Display Name | How It Works |
|------|-------------|-------------|
| Anonymous | Generated name (e.g., "Crimson Tiger") | `persistentHash(publicKey)` stored as hash bytes, UI generates readable name |
| Public | Truncated wallet address | Wallet address sent via witness as custom name |
| Custom | Player's chosen name | Player types a name, sent via `getCustomName()` witness |

All modes store `ownerHash = persistentHash(publicKey)` as `Bytes<32>` on each entry, enabling ownership verification without revealing identity.

### Circuits

| Circuit | Purpose |
|---------|---------|
| `submitScore(score, useCustomName)` | Create a new leaderboard entry |
| `verifyOwnership(targetEntryId)` | Prove you own an entry (for prizes, badges) |
| `getEntryCount()` | Read total number of entries |

## Production Deployment

The DApp runs on two services: Vercel for the static frontend (free) and Railway for the proof server ($5/mo).

The proof server is needed because browser JavaScript cannot reach Midnight's public proof server directly (CORS). Railway runs its own instance of the proof server Docker image, which accepts requests from any origin.

### Proof server (Railway)

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Create a new project from this repo
3. Set **Root Directory** to `proof-server`
4. In **Settings**, then **Networking**, set port to `6300` and generate a domain
5. Copy the HTTPS URL

### Frontend (Vercel)

1. Import the repo into [Vercel](https://vercel.com)
2. Vercel reads `vercel.json` automatically
3. Make sure **Root Directory** is empty (not set to a subdirectory)
4. Deploy

Circuit keys are committed in `contract/managed/` so no Compact compiler is needed on Vercel.

## Compatibility

Built against the [Midnight compatibility matrix](https://docs.midnight.network/relnotes/support-matrix):

| Component | Version |
|-----------|--------|
| Compact Compiler | 0.31.0 |
| Compact Runtime | 0.16.0 |
| Ledger | 8.0.3 |
| midnight-js | 4.0.4 |
| DApp Connector API | 4.0.1 |
| Proof Server | 8.0.3 |

## License

Apache-2.0

Built on the [Midnight Network](https://midnight.network).
