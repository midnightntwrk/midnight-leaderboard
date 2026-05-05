/**
 * @file Leaderboard Contract Simulator
 * @author Jay Albert
 * @license MIT
 *
 * Simulates the Compact contract logic in TypeScript for testing.
 * Matches the revised leaderboard.compact (best-score-per-user model).
 */

export enum DisplayMode {
  PUBLIC = 0,
  ANONYMOUS = 1,
  CUSTOM = 2,
}

export interface ScoreEntry {
  score: bigint;
  displayName: Uint8Array;
}

export class LeaderboardSimulator {
  private scores: Map<bigint, ScoreEntry> = new Map();
  private totalParticipants: bigint = 0n;

  /**
   * Simulates Compact's persistentHash<Bytes<32>>.
   * Real contract uses a ZK-friendly hash; this is a stand-in for testing.
   */
  persistentHash(bytes: Uint8Array): bigint {
    let hash = 0n;
    for (let i = 0; i < bytes.length; i++) {
      hash = (hash * 31n + BigInt(bytes[i])) % 2n ** 252n;
    }
    return hash;
  }

  /**
   * Simulates the submitScore circuit.
   *
   * - New player: insert entry, increment participant count
   * - Existing player with higher score: update entry
   * - Existing player with lower/equal score: no-op
   */
  submitScore(
    userPublicKey: Uint8Array,
    score: bigint,
    displayMode: DisplayMode,
    customName?: Uint8Array
  ): void {
    const userHash = this.persistentHash(userPublicKey);

    // Build display name based on mode (mirrors contract logic)
    let displayName: Uint8Array;
    if (displayMode === DisplayMode.PUBLIC) {
      displayName = userPublicKey;
    } else if (displayMode === DisplayMode.ANONYMOUS) {
      // Contract uses persistentHash of public key as display name
      displayName = this.hashToBytes(userPublicKey);
    } else {
      if (!customName) {
        throw new Error('Custom name required for CUSTOM display mode');
      }
      displayName = customName;
    }

    if (this.scores.has(userHash)) {
      // Existing player — only update if new score is higher
      const existing = this.scores.get(userHash)!;
      if (score > existing.score) {
        this.scores.set(userHash, { score, displayName });
      }
    } else {
      // New player — insert and count
      this.scores.set(userHash, { score, displayName });
      this.totalParticipants++;
    }
  }

  /** Simulates getTotalParticipants circuit */
  getTotalParticipants(): bigint {
    return this.totalParticipants;
  }

  /** Simulates verifyOwnership circuit */
  verifyOwnership(callerPublicKey: Uint8Array, targetHash: bigint): boolean {
    if (!this.scores.has(targetHash)) return false;
    const callerHash = this.persistentHash(callerPublicKey);
    return callerHash === targetHash;
  }

  // ── Test helpers (not part of the contract) ────────────────────────────

  getUserHash(userPublicKey: Uint8Array): bigint {
    return this.persistentHash(userPublicKey);
  }

  getUserScore(userHash: bigint): bigint {
    if (!this.scores.has(userHash)) {
      throw new Error('User has no score');
    }
    return this.scores.get(userHash)!.score;
  }

  getEntryByHash(userHash: bigint): ScoreEntry | undefined {
    return this.scores.get(userHash);
  }

  getAllEntries(): Array<{ userHash: bigint; entry: ScoreEntry }> {
    return Array.from(this.scores.entries()).map(([userHash, entry]) => ({
      userHash,
      entry,
    }));
  }

  /**
   * Convert a public key to its hashed Bytes<32> representation.
   * Used for ANONYMOUS mode display name.
   */
  private hashToBytes(publicKey: Uint8Array): Uint8Array {
    const hash = this.persistentHash(publicKey);
    const bytes = new Uint8Array(32);
    let h = hash;
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(h & 0xffn);
      h >>= 8n;
    }
    return bytes;
  }
}
