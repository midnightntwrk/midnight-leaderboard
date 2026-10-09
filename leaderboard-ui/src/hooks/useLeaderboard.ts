/**
 * useLeaderboard — reads on-chain leaderboard state from the indexer.
 *
 * Uses the same GraphQL query as midnight-js-indexer-public-data-provider
 * but via a simple fetch() so it works in the browser without Apollo.
 * Parses the state with the compiled contract's ledger() function.
 */

import { useState, useEffect, useCallback } from 'react';
import { ContractState } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Leaderboard } from 'leaderboard-contract';
import { decodeDisplayName } from '../../../api/src/utils/index.js';

// Blockfrost serves the Preprod indexer, and every request needs a Midnight Preprod
// project token. Vite builds the token into the browser bundle, where anyone who
// loads the page can read it, so use a token you are prepared to treat as public.
const BLOCKFROST_PROJECT_ID = import.meta.env.VITE_BLOCKFROST_PROJECT_ID ?? '';
const INDEXER_URL = `${import.meta.env.VITE_INDEXER_URL ?? 'https://midnight-preprod.blockfrost.io/api/v0'}?project_id=${encodeURIComponent(BLOCKFROST_PROJECT_ID)}`;

const CONTRACT_STATE_QUERY = `
  query ContractState($address: HexEncoded!) {
    contractAction(address: $address) {
      state
    }
  }
`;

export interface LeaderboardEntry {
  id: number;
  score: number;
  displayName: string;
  ownerHash: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export function useLeaderboard(contractAddress: string | null, refreshInterval = 15_000) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (!contractAddress || !/^[0-9a-fA-F]{64}$/.test(contractAddress)) return;

    try {
      setLoading(true);
      const res = await fetch(INDEXER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CONTRACT_STATE_QUERY, variables: { address: contractAddress } }),
      });

      const gql = await res.json();
      if (gql.errors) {
        throw new Error(gql.errors[0]?.message ?? 'Indexer query failed');
      }

      const stateHex = gql.data?.contractAction?.state;
      if (!stateHex) {
        throw new Error('Contract not found');
      }

      const contractState = ContractState.deserialize(hexToBytes(stateHex));
      const ledgerState = Leaderboard.ledger(contractState.data);

      const parsed: LeaderboardEntry[] = [];
      for (const [key, entry] of ledgerState.scores) {
        parsed.push({
          id: Number(key),
          score: Number(entry.score),
          displayName: decodeDisplayName(entry.displayName, Number(key), Number(entry.score)),
          ownerHash: entry.ownerHash.toString(),
        });
      }
      parsed.sort((a, b) => b.score - a.score);

      setEntries(parsed);
      setEntryCount(Number(ledgerState.nextId));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [contractAddress]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useEffect(() => {
    if (!contractAddress) return;
    const interval = setInterval(fetchLeaderboard, refreshInterval);
    return () => clearInterval(interval);
  }, [contractAddress, refreshInterval, fetchLeaderboard]);

  return { entries, entryCount, loading, error, refresh: fetchLeaderboard };
}
