/**
 * @file Leaderboard Contract Tests
 * @author Jay Albert
 * @license MIT
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderboardSimulator, DisplayMode } from './leaderboard-simulator';

/** Encode a string to a zero-padded Bytes<32> Uint8Array. */
const encodeDisplayName = (name: string): Uint8Array => {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode(name).slice(0, 32));
  return bytes;
};

describe('Leaderboard Contract', () => {
  let sim: LeaderboardSimulator;
  let userKey: Uint8Array;
  let otherKey: Uint8Array;

  beforeEach(() => {
    sim = new LeaderboardSimulator();
    userKey = new Uint8Array(32).fill(1);
    otherKey = new Uint8Array(32).fill(2);
  });

  describe('encodeDisplayName', () => {
    it('encodes custom name to 32 bytes', () => {
      const bytes = encodeDisplayName('PlayerOne');
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
      const decoded = new TextDecoder().decode(bytes).replace(/\0/g, '');
      expect(decoded).toBe('PlayerOne');
    });

    it('truncates names longer than 32 bytes', () => {
      const bytes = encodeDisplayName('ThisIsAVeryLongNameThatExceedsThirtyTwoBytes');
      expect(bytes.length).toBe(32);
    });

    it('pads short names with zeros', () => {
      const bytes = encodeDisplayName('Hi');
      expect(bytes.length).toBe(32);
      expect(bytes[0]).not.toBe(0);
      expect(bytes[31]).toBe(0);
    });
  });

  describe('submitScore', () => {
    it('submits in PUBLIC mode (displayName = public key)', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      const hash = sim.getUserHash(userKey);
      const entry = sim.getEntryByHash(hash)!;
      expect(entry.score).toBe(1000n);
      expect(entry.displayName).toEqual(userKey);
    });

    it('submits in ANONYMOUS mode (displayName = hash of public key)', () => {
      sim.submitScore(userKey, 2000n, DisplayMode.ANONYMOUS);
      const hash = sim.getUserHash(userKey);
      const entry = sim.getEntryByHash(hash)!;
      expect(entry.score).toBe(2000n);
      expect(entry.displayName).not.toEqual(userKey);
      expect(entry.displayName.length).toBe(32);
    });

    it('submits in CUSTOM mode (displayName = custom name)', () => {
      const nameBytes = encodeDisplayName('CryptoNinja');
      sim.submitScore(userKey, 3000n, DisplayMode.CUSTOM, nameBytes);
      const hash = sim.getUserHash(userKey);
      const entry = sim.getEntryByHash(hash)!;
      const decoded = new TextDecoder().decode(entry.displayName).replace(/\0/g, '');
      expect(decoded).toBe('CryptoNinja');
    });

    it('throws when CUSTOM mode lacks custom name', () => {
      expect(() => {
        sim.submitScore(userKey, 1000n, DisplayMode.CUSTOM);
      }).toThrow('Custom name required for CUSTOM display mode');
    });

    it('updates to a higher score', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      sim.submitScore(userKey, 5000n, DisplayMode.PUBLIC);
      expect(sim.getUserScore(sim.getUserHash(userKey))).toBe(5000n);
    });

    it('does NOT update to a lower score', () => {
      sim.submitScore(userKey, 5000n, DisplayMode.PUBLIC);
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      expect(sim.getUserScore(sim.getUserHash(userKey))).toBe(5000n);
    });

    it('does NOT update to an equal score', () => {
      sim.submitScore(userKey, 3000n, DisplayMode.PUBLIC);
      sim.submitScore(userKey, 3000n, DisplayMode.PUBLIC);
      expect(sim.getUserScore(sim.getUserHash(userKey))).toBe(3000n);
    });

    it('tracks different users separately', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      sim.submitScore(otherKey, 2000n, DisplayMode.PUBLIC);
      expect(sim.getUserScore(sim.getUserHash(userKey))).toBe(1000n);
      expect(sim.getUserScore(sim.getUserHash(otherKey))).toBe(2000n);
    });

    it('increments totalParticipants only for new users', () => {
      expect(sim.getTotalParticipants()).toBe(0n);
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      expect(sim.getTotalParticipants()).toBe(1n);
      sim.submitScore(userKey, 2000n, DisplayMode.PUBLIC);
      expect(sim.getTotalParticipants()).toBe(1n);
      sim.submitScore(otherKey, 3000n, DisplayMode.PUBLIC);
      expect(sim.getTotalParticipants()).toBe(2n);
    });
  });

  describe('getTotalParticipants', () => {
    it('starts at zero', () => {
      expect(sim.getTotalParticipants()).toBe(0n);
    });

    it('counts unique participants', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      sim.submitScore(otherKey, 2000n, DisplayMode.PUBLIC);
      expect(sim.getTotalParticipants()).toBe(2n);
    });
  });

  describe('verifyOwnership', () => {
    it('returns true when caller owns the entry', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.ANONYMOUS);
      const hash = sim.getUserHash(userKey);
      expect(sim.verifyOwnership(userKey, hash)).toBe(true);
    });

    it('returns false when caller does not own the entry', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.ANONYMOUS);
      const hash = sim.getUserHash(userKey);
      expect(sim.verifyOwnership(otherKey, hash)).toBe(false);
    });

    it('returns false for non-existent entry', () => {
      const hash = sim.getUserHash(userKey);
      expect(sim.verifyOwnership(userKey, hash)).toBe(false);
    });
  });

  describe('Privacy guarantees', () => {
    it('PUBLIC mode reveals the actual public key', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      const entry = sim.getEntryByHash(sim.getUserHash(userKey))!;
      expect(entry.displayName).toEqual(userKey);
    });

    it('ANONYMOUS mode hides the public key', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.ANONYMOUS);
      const entry = sim.getEntryByHash(sim.getUserHash(userKey))!;
      expect(entry.displayName).not.toEqual(userKey);
    });

    it('CUSTOM mode shows chosen name, not public key', () => {
      const nameBytes = encodeDisplayName('GhostPlayer');
      sim.submitScore(userKey, 1000n, DisplayMode.CUSTOM, nameBytes);
      const entry = sim.getEntryByHash(sim.getUserHash(userKey))!;
      expect(entry.displayName).toEqual(nameBytes);
      expect(entry.displayName).not.toEqual(userKey);
    });

    it('two anonymous users produce different display names', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.ANONYMOUS);
      sim.submitScore(otherKey, 2000n, DisplayMode.ANONYMOUS);
      const entry1 = sim.getEntryByHash(sim.getUserHash(userKey))!;
      const entry2 = sim.getEntryByHash(sim.getUserHash(otherKey))!;
      expect(entry1.displayName).not.toEqual(entry2.displayName);
    });
  });

  describe('Leaderboard queries', () => {
    it('retrieves all entries', () => {
      sim.submitScore(userKey, 1000n, DisplayMode.PUBLIC);
      sim.submitScore(otherKey, 2000n, DisplayMode.ANONYMOUS);
      expect(sim.getAllEntries().length).toBe(2);
    });

    it('supports off-chain sorting by score', () => {
      const user3 = new Uint8Array(32).fill(3);
      sim.submitScore(userKey, 5000n, DisplayMode.PUBLIC);
      sim.submitScore(otherKey, 8000n, DisplayMode.PUBLIC);
      sim.submitScore(user3, 3000n, DisplayMode.PUBLIC);

      const sorted = sim.getAllEntries().sort((a, b) =>
        a.entry.score > b.entry.score ? -1 : a.entry.score < b.entry.score ? 1 : 0
      );

      expect(sorted[0].entry.score).toBe(8000n);
      expect(sorted[1].entry.score).toBe(5000n);
      expect(sorted[2].entry.score).toBe(3000n);
    });
  });
});
