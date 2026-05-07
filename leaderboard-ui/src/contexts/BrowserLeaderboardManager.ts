/**
 * Browser-side provider initialization for the leaderboard DApp.
 * Connects to Lace wallet via DApp Connector API and bridges
 * wallet operations to the LeaderboardAPI.
 */

import { LeaderboardAPI, type LeaderboardCircuitKeys, type LeaderboardProviders } from '../../../api/src/index';
import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/compact-runtime';
import { BehaviorSubject, catchError, concatMap, filter, firstValueFrom, interval, map, type Observable, take, throwError, timeout } from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { type ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import semver from 'semver';
import { Binding, type FinalizedTransaction, Proof, SignatureEnabled, Transaction, type TransactionId } from '@midnight-ntwrk/ledger-v8';
import { type LeaderboardPrivateState } from 'leaderboard-contract';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { type NetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';

export type LeaderboardDeployment =
  | { readonly status: 'in-progress' }
  | { readonly status: 'deployed'; readonly api: LeaderboardAPI }
  | { readonly status: 'failed'; readonly error: Error };

/**
 * Manages leaderboard contract connections in a browser setting.
 * Connects to Lace, initializes providers, delegates to LeaderboardAPI.
 */
export class BrowserLeaderboardManager {
  readonly #deploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<LeaderboardDeployment>>>([]);
  #initializedProviders: Promise<LeaderboardProviders> | undefined;

  constructor(private readonly logger: Logger) {}

  readonly deployments$: Observable<Array<Observable<LeaderboardDeployment>>> = this.#deploymentsSubject;

  resolve(contractAddress?: ContractAddress): Observable<LeaderboardDeployment> {
    const deployments = this.#deploymentsSubject.value;
    const existing = deployments.find(
      (d) => d.value.status === 'deployed' && d.value.api.deployedContractAddress === contractAddress,
    );
    if (existing) return existing;

    const deployment = new BehaviorSubject<LeaderboardDeployment>({ status: 'in-progress' });
    if (contractAddress) {
      void this.run(deployment, (providers) => LeaderboardAPI.join(providers, contractAddress, this.logger));
    } else {
      void this.run(deployment, (providers) => LeaderboardAPI.deploy(providers, this.logger));
    }
    this.#deploymentsSubject.next([...deployments, deployment]);
    return deployment;
  }

  private getProviders(): Promise<LeaderboardProviders> {
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async run(
    deployment: BehaviorSubject<LeaderboardDeployment>,
    factory: (providers: LeaderboardProviders) => Promise<LeaderboardAPI>,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await factory(providers);
      deployment.next({ status: 'deployed', api });
    } catch (error: unknown) {
      console.error('Contract operation failed:', error);
      let err: Error;
      if (error instanceof Error) {
        err = error;
      } else if (typeof error === 'string') {
        err = new Error(error);
      } else {
        err = new Error(JSON.stringify(error) || 'Unknown error during contract operation');
      }
      deployment.next({ status: 'failed', error: err });
    }
  }
}

// ── Provider initialization ────────────────────────────────────────────

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

const initializeProviders = async (logger: Logger): Promise<LeaderboardProviders> => {
  const networkId = import.meta.env.VITE_NETWORK_ID as NetworkId;
  setNetworkId(networkId);

  const connectedAPI = await connectToWallet(logger, networkId);
  const config = await connectedAPI.getConfiguration();
  const rawProofUri = import.meta.env.VITE_PROOF_SERVER_URL ?? config.proverServerUri!;
  const proofServerUri = rawProofUri.startsWith('/') ? `${window.location.origin}${rawProofUri}` : rawProofUri;
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<LeaderboardCircuitKeys>(window.location.origin, fetch.bind(window));

  return {
    privateStateProvider: inMemoryPrivateStateProvider<string, LeaderboardPrivateState>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
        const received = await connectedAPI.balanceUnsealedTransaction(toHex(tx.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', fromHex(received.tx));
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
};

// ── Wallet detection ───────────────────────────────────────────────────

const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet && typeof wallet === 'object' && 'apiVersion' in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

const connectToWallet = (logger: Logger, networkId: string): Promise<ConnectedAPI> =>
  firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getFirstCompatibleWallet()),
      filter((api): api is InitialAPI => !!api),
      take(1),
      timeout({ first: 3_000, with: () => throwError(() => new Error('Could not find Midnight Lace wallet.')) }),
      concatMap(async (initialAPI) => initialAPI.connect(networkId)),
      timeout({ first: 5_000, with: () => throwError(() => new Error('Lace wallet failed to respond.')) }),
      catchError((error) => throwError(() => error instanceof Error ? error : new Error('Wallet not authorized'))),
    ),
  );
