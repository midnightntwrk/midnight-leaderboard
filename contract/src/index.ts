import { CompiledContract } from '@midnight-ntwrk/compact-js';

export * as Leaderboard from '../managed/leaderboard/contract/index.js';
export { createWitnesses, setCustomName } from './witnesses.js';

import * as LeaderboardContract from '../managed/leaderboard/contract/index.js';
import { createWitnesses } from './witnesses.js';

export type LeaderboardPrivateState = Record<string, unknown>;

export const CompiledLeaderboardContract = CompiledContract.make(
  'leaderboard',
  LeaderboardContract.Contract,
).pipe(
  CompiledContract.withWitnesses(createWitnesses()),
  CompiledContract.withCompiledFileAssets('./managed/leaderboard'),
);
