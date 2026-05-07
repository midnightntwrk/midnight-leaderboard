/**
 * Shared business logic for the leaderboard contract.
 *
 * Platform-agnostic — works from browser (Lace) or CLI (wallet-sdk).
 * Each platform provides its own provider implementations.
 *
 * @packageDocumentation
 */

import * as Leaderboard from '../../contract/managed/leaderboard/contract/index.js';
import { type ContractAddress } from '@midnight-ntwrk/compact-runtime';
import { type Logger } from 'pino';
import {
  type LeaderboardDerivedState,
  type LeaderboardEntry,
  type LeaderboardProviders,
  type DeployedLeaderboardContract,
  leaderboardPrivateStateKey,
} from './common-types.js';
import { CompiledLeaderboardContract, type LeaderboardPrivateState } from '../../contract/src/index';
import { setCustomName } from '../../contract/src/witnesses.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { map, type Observable } from 'rxjs';

/**
 * API for a deployed leaderboard contract.
 *
 * Created via `LeaderboardAPI.deploy()` (admin) or `LeaderboardAPI.join()` (player).
 */
export class LeaderboardAPI {
  private constructor(
    public readonly deployedContract: DeployedLeaderboardContract,
    providers: LeaderboardProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);

    this.state$ = providers.publicDataProvider
      .contractStateObservable(this.deployedContractAddress, { type: 'latest' })
      .pipe(
        map((contractState) => Leaderboard.ledger(contractState.data)),
        map((ledgerState): LeaderboardDerivedState => {
          const entries: LeaderboardEntry[] = [];
          for (const [key, entry] of ledgerState.scores) {
            entries.push({
              id: Number(key),
              score: Number(entry.score),
              displayName: utils.decodeDisplayName(entry.displayName, Number(key), Number(entry.score)),
              ownerHash: entry.ownerHash.toString(),
            });
          }
          entries.sort((a, b) => b.score - a.score);
          return { entryCount: Number(ledgerState.nextId), entries };
        }),
      );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<LeaderboardDerivedState>;

  /** Submit a score. If customName is provided, it's used as display name via witness. */
  async submitScore(score: number, customName?: string): Promise<void> {
    if (customName) {
      setCustomName(customName);
    }
    await (this.deployedContract as any).callTx.submitScore(BigInt(score), !!customName);
  }

  /** Prove ownership of a leaderboard entry. The proof is private — use it to claim a prize or verify identity. */
  async verifyOwnership(entryId: number): Promise<void> {
    await (this.deployedContract as any).callTx.verifyOwnership(BigInt(entryId));
  }

  /** Deploy a new leaderboard contract (admin operation). */
  static async deploy(providers: LeaderboardProviders, logger?: Logger): Promise<LeaderboardAPI> {
    const deployedContract = await deployContract(providers as any, {
      compiledContract: CompiledLeaderboardContract,
      privateStateId: leaderboardPrivateStateKey,
      initialPrivateState: {} as LeaderboardPrivateState,
    });
    return new LeaderboardAPI(deployedContract, providers, logger);
  }

  /** Join an existing leaderboard contract (player operation). */
  static async join(
    providers: LeaderboardProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<LeaderboardAPI> {
    const deployedContract = await findDeployedContract(providers as any, {
      contractAddress,
      compiledContract: CompiledLeaderboardContract,
      privateStateId: leaderboardPrivateStateKey,
      initialPrivateState: {} as LeaderboardPrivateState,
    });
    return new LeaderboardAPI(deployedContract, providers, logger);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
