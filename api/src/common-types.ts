/**
 * Leaderboard common types and abstractions.
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { type LeaderboardPrivateState } from '../../contract/src/index';

export const leaderboardPrivateStateKey = 'leaderboardPrivateState';
export type PrivateStateId = typeof leaderboardPrivateStateKey;

export type LeaderboardCircuitKeys = 'submitScore' | 'getEntryCount' | 'verifyOwnership';
export type LeaderboardProviders = MidnightProviders<LeaderboardCircuitKeys, PrivateStateId, LeaderboardPrivateState>;
export type DeployedLeaderboardContract = FoundContract<any>;

export interface LeaderboardEntry {
  readonly id: number;
  readonly score: number;
  readonly displayName: string;
  readonly ownerHash: string;
}

export interface LeaderboardDerivedState {
  readonly entryCount: number;
  readonly entries: LeaderboardEntry[];
}
