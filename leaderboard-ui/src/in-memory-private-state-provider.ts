/**
 * In-memory private state provider for browser use.
 * Copied from bboard example — required by midnight-js contracts.
 */

import type { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';
import type {
  ExportPrivateStatesOptions,
  ExportSigningKeysOptions,
  ImportPrivateStatesOptions,
  ImportPrivateStatesResult,
  ImportSigningKeysOptions,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS = unknown>(): PrivateStateProvider<PSI, PS> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let contractAddress: ContractAddress | null = null;

  const requireContractAddress = (): ContractAddress => {
    if (contractAddress === null) throw new Error('Contract address not set');
    return contractAddress;
  };

  const getScopedStates = (address: ContractAddress): Map<PSI, PS> => {
    let scopedStates = privateStates.get(address);
    if (!scopedStates) {
      scopedStates = new Map<PSI, PS>();
      privateStates.set(address, scopedStates);
    }
    return scopedStates;
  };

  const encode = <T>(value: T): string => JSON.stringify(value);
  const decode = <T>(value: string): T => JSON.parse(value) as T;

  return {
    setContractAddress(address: ContractAddress): void { contractAddress = address; },
    set(key: PSI, state: PS): Promise<void> {
      getScopedStates(requireContractAddress()).set(key, state);
      return Promise.resolve();
    },
    get(key: PSI): Promise<PS | null> {
      return Promise.resolve(getScopedStates(requireContractAddress()).get(key) ?? null);
    },
    remove(key: PSI): Promise<void> {
      getScopedStates(requireContractAddress()).delete(key);
      return Promise.resolve();
    },
    clear(): Promise<void> {
      privateStates.delete(requireContractAddress());
      return Promise.resolve();
    },
    setSigningKey(addr: ContractAddress, key: SigningKey): Promise<void> {
      signingKeys.set(addr, key);
      return Promise.resolve();
    },
    getSigningKey(addr: ContractAddress): Promise<SigningKey | null> {
      return Promise.resolve(signingKeys.get(addr) ?? null);
    },
    removeSigningKey(addr: ContractAddress): Promise<void> {
      signingKeys.delete(addr);
      return Promise.resolve();
    },
    clearSigningKeys(): Promise<void> {
      signingKeys.clear();
      return Promise.resolve();
    },
    exportPrivateStates(_options?: ExportPrivateStatesOptions): Promise<PrivateStateExport> {
      const address = requireContractAddress();
      const states = Object.fromEntries(
        Array.from(getScopedStates(address).entries()).map(([k, v]) => [k, encode(v)]),
      );
      return Promise.resolve({
        format: 'midnight-private-state-export',
        encryptedPayload: encode({ contractAddress: address, states }),
        salt: 'in-memory',
      });
    },
    importPrivateStates(exportData: PrivateStateExport, options?: ImportPrivateStatesOptions): Promise<ImportPrivateStatesResult> {
      const address = requireContractAddress();
      const strategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ states?: Record<string, string> }>(exportData.encryptedPayload);
      const scopedStates = getScopedStates(address);
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [rawId, serialized] of Object.entries(payload.states ?? {})) {
        const id = rawId as PSI;
        if (scopedStates.has(id)) {
          if (strategy === 'skip') { skipped++; continue; }
          if (strategy === 'error') return Promise.reject(new Error(`Conflict: ${id}`));
          overwritten++;
        } else { imported++; }
        scopedStates.set(id, decode<PS>(serialized));
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
    exportSigningKeys(_options?: ExportSigningKeysOptions): Promise<SigningKeyExport> {
      return Promise.resolve({
        format: 'midnight-signing-key-export',
        encryptedPayload: encode({ keys: Object.fromEntries(signingKeys.entries()) }),
        salt: 'in-memory',
      });
    },
    importSigningKeys(exportData: SigningKeyExport, options?: ImportSigningKeysOptions): Promise<ImportSigningKeysResult> {
      const strategy = options?.conflictStrategy ?? 'error';
      const payload = decode<{ keys?: Record<string, SigningKey> }>(exportData.encryptedPayload);
      let imported = 0, skipped = 0, overwritten = 0;
      for (const [addr, key] of Object.entries(payload.keys ?? {})) {
        if (signingKeys.has(addr)) {
          if (strategy === 'skip') { skipped++; continue; }
          if (strategy === 'error') return Promise.reject(new Error(`Conflict: ${addr}`));
          overwritten++;
        } else { imported++; }
        signingKeys.set(addr, key);
      }
      return Promise.resolve({ imported, skipped, overwritten });
    },
  };
};
