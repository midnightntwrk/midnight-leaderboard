# Leaderboard Smart Contract

Privacy-preserving per-user leaderboard contract for Midnight Network.

## Overview

Best-score-per-user leaderboard where each player's highest score is tracked with configurable privacy settings. Designed as a tutorial showing how to extend the counter example's single `Counter` into a `Map`-based per-user state model.

## Contract at a Glance

**File**: `leaderboard.compact` (~95 lines)
**Language**: `pragma language_version >= 0.20`
**Circuits**: 3 (`submitScore`, `getTotalParticipants`, `verifyOwnership`)
**Witnesses**: 1 (`getCustomName`)

## Data Structures

```compact
enum DisplayMode { PUBLIC, ANONYMOUS, CUSTOM }

struct ScoreEntry {
  score: Uint<64>,
  displayName: Bytes<32>
}
```

## Ledger State

```compact
export ledger scores: Map<Field, ScoreEntry>;  // keyed by hash(publicKey)
export ledger totalParticipants: Counter;
```

- **scores** — one entry per unique player, keyed by `persistentHash(publicKey)`
- **totalParticipants** — count of unique players (incremented only on first submission)

## Circuits

### `submitScore(score: Uint<64>, displayMode: DisplayMode): []`

Submit a score. If the player already has an entry, only updates if the new score is higher (best-score-per-user).

The `displayMode` controls what appears as `displayName`:
- **PUBLIC**: raw public key bytes (fully transparent)
- **ANONYMOUS**: `persistentHash(publicKey)` (pseudonymous)
- **CUSTOM**: name from `getCustomName()` witness (player's choice)

### `getTotalParticipants(): Uint<64>`

Returns the count of unique players. Mirrors the counter example's read pattern.

### `verifyOwnership(targetHash: Field): Boolean`

Proves the caller owns the entry at `targetHash`. Essential for prize claiming — proves identity without revealing it in ANONYMOUS or CUSTOM mode.

## Key Differences from Counter Example

| Aspect | Counter | Leaderboard |
|--------|---------|-------------|
| Ledger | `Counter` | `Map<Field, ScoreEntry>` + `Counter` |
| Write | Always increments | Conditional (only if higher) |
| Identity | None | `persistentHash(ownPublicKey())` |
| Privacy | N/A | 3 display modes |
| Read | Single value | Map lookup by hash |

## Compilation

```bash
compact compile contract/leaderboard.compact contract/managed/leaderboard
```

Generates TypeScript bindings in `managed/leaderboard/`.

## Testing

```bash
npm test
```

Tests use a TypeScript simulator (`test/leaderboard-simulator.ts`) that mirrors the Compact contract logic, following the same pattern as the counter example's test suite.
