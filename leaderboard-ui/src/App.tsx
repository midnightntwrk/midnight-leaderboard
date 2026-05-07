/**
 * Midnight Leaderboard — React Web Interface
 *
 * Auto-loads the default leaderboard contract on startup.
 * Reads scores from the Preprod indexer (no wallet needed).
 * Score submission via Lace DApp Connector (wallet required).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { useLeaderboard } from './hooks/useLeaderboard';
import { BrowserLeaderboardManager } from './contexts/BrowserLeaderboardManager';
import pino from 'pino';

const NETWORK_ID = import.meta.env.VITE_NETWORK_ID ?? 'preprod';
const DEFAULT_CONTRACT = import.meta.env.VITE_DEFAULT_CONTRACT ?? '';

enum DisplayMode { PUBLIC = 0, ANONYMOUS = 1, CUSTOM = 2 }

type WalletState = 'detecting' | 'no-wallet' | 'ready' | 'connecting' | 'connected';

function findWallet(): InitialAPI | undefined {
  const midnight = (window as any).midnight;
  if (!midnight) return undefined;
  return Object.values(midnight).find(
    (w): w is InitialAPI => !!w && typeof w === 'object' && 'apiVersion' in w,
  );
}

function truncAddr(addr: string): string {
  return addr.length <= 24 ? addr : `${addr.slice(0, 14)}…${addr.slice(-8)}`;
}

function fmtScore(n: bigint | number): string {
  return Number(n).toLocaleString();
}

async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

function friendlyError(e: any): string {
  // Extract message from nested Effect-TS FiberFailure errors
  const msg = extractErrorMessage(e);
  if (msg.includes('User rejected')) return 'Transaction cancelled.';
  if (msg.includes('not the owner')) return 'This entry does not belong to your wallet.';
  if (msg.includes('entry not found')) return 'Entry not found on the leaderboard.';
  if (msg.includes('Failed to fetch') || msg.includes('Failed Proof Server')) return 'Could not reach the proof server. Check your connection and try again.';
  if (msg.includes('mismatched verifier keys')) return 'Contract version mismatch. Try deploying a new leaderboard.';
  if (msg.includes('not authorized')) return 'Wallet connection was rejected. Try connecting again.';
  if (msg.includes('insufficient') || msg.includes('DUST')) return 'Insufficient funds. Request tokens from the Preprod faucet.';
  if (msg.includes('Network ID')) return 'Network configuration error. Make sure Lace is set to Preprod.';
  if (msg.includes('submission') || msg.includes('Submission')) return 'Transaction failed to submit. Please try again.';
  return msg || 'An unexpected error occurred. Check the browser console for details.';
}

function extractErrorMessage(e: any): string {
  if (!e) return '';
  // Direct message
  if (e.message && e.message !== '') return e.message;
  // Effect-TS FiberFailure: error.cause.failure.message or .cause.message
  const failure = e?.cause?.failure;
  if (failure?.message) return failure.message;
  if (failure?.cause?.message) return failure.cause.message;
  // Nested cause chain
  if (e?.cause?.message) return e.cause.message;
  // Stringify as last resort
  try { return JSON.stringify(e); } catch { return String(e); }
}

export default function App() {
  const [walletState, setWalletState] = useState<WalletState>('detecting');
  const [walletAPI, setWalletAPI] = useState<InitialAPI | undefined>();
  const [wallet, setWallet] = useState<ConnectedAPI | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT);
  const [joinInput, setJoinInput] = useState('');
  const [showJoinPanel, setShowJoinPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const [clicks, setClicks] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [showResult, setShowResult] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickRef = useRef(0);

  const [displayMode, setDisplayMode] = useState<DisplayMode>(DisplayMode.ANONYMOUS);
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifiedIds, setVerifiedIds] = useState<Set<number>>(new Set());

  const { entries: leaderboardEntries, refresh: refreshLeaderboard } = useLeaderboard(contractAddress || null);
  const leaderboard = leaderboardEntries.map((e, i) => ({
    rank: i + 1, id: e.id, displayName: e.displayName, score: BigInt(e.score),
  }));

  // ── Wallet detection ─────────────────────────────────────────────────

  useEffect(() => {
    const found = findWallet();
    if (found) { setWalletAPI(found); setWalletState('ready'); return; }
    let elapsed = 0;
    const t = setInterval(() => {
      elapsed += 100;
      const w = findWallet();
      if (w) { setWalletAPI(w); setWalletState('ready'); clearInterval(t); }
      else if (elapsed >= 5_000) { setWalletState('no-wallet'); clearInterval(t); }
    }, 100);
    return () => clearInterval(t);
  }, []);

  // ── Wallet connect ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    if (!walletAPI) return;
    setWalletState('connecting');
    setError(null);
    try {
      const c = await walletAPI.connect(NETWORK_ID);
      setWallet(c);
      const { unshieldedAddress } = await c.getUnshieldedAddress();
      setAddress(unshieldedAddress);
      setWalletState('connected');
    } catch (e) {
      setError(friendlyError(e));
      setWalletState('ready');
    }
  }, [walletAPI]);

  // ── Deploy new contract ──────────────────────────────────────────────

  const deployContract = useCallback(async () => {
    if (!wallet) return;
    setDeploying(true);
    setError(null);
    try {
      const logger = pino({ level: 'warn', browser: { asObject: true } });
      const manager = new BrowserLeaderboardManager(logger);
      const deployment$ = manager.resolve();
      const result = await new Promise<any>((resolve, reject) => {
        const sub = deployment$.subscribe((d) => {
          if (d.status === 'deployed') { sub.unsubscribe(); resolve(d); }
          if (d.status === 'failed') { sub.unsubscribe(); reject(d.error); }
        });
      });
      setContractAddress(result.api.deployedContractAddress);
      setShowJoinPanel(false);
      setClicks(0); setShowResult(false);
      await copyToClipboard(result.api.deployedContractAddress);
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setDeploying(false);
    }
  }, [wallet]);

  // ── Join contract ────────────────────────────────────────────────────

  const joinContract = useCallback(() => {
    const addr = joinInput.trim();
    if (!addr) return;
    if (!/^[0-9a-fA-F]{64}$/.test(addr)) {
      setError('Invalid contract address. Must be 64 hex characters.');
      return;
    }
    setContractAddress(addr);
    setShowJoinPanel(false); setJoinInput('');
    setClicks(0); setShowResult(false);
  }, [joinInput]);

  // ── Copy address ─────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!contractAddress) return;
    if (await copyToClipboard(contractAddress)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [contractAddress]);

  // ── Game logic ───────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setClicks(0); clickRef.current = 0;
    setTimeLeft(10); setIsPlaying(true); setShowResult(false);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setIsPlaying(false); setShowResult(true);
          setLastScore(clickRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
  }, []);

  const handleClick = useCallback(() => {
    if (!isPlaying) return;
    clickRef.current += 1;
    setClicks(clickRef.current);
  }, [isPlaying]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ── Submit score ─────────────────────────────────────────────────────

  const submitScore = useCallback(async () => {
    if (lastScore === 0 || !wallet) return;
    setSubmitting(true);
    setSubmitStatus('Joining contract…');
    setError(null);
    try {
      const logger = pino({ level: 'warn', browser: { asObject: true } });
      const manager = new BrowserLeaderboardManager(logger);
      const deployment$ = manager.resolve(contractAddress as any);
      const result = await new Promise<any>((resolve, reject) => {
        const sub = deployment$.subscribe((d) => {
          if (d.status === 'deployed') { sub.unsubscribe(); resolve(d); }
          if (d.status === 'failed') { sub.unsubscribe(); reject(d.error); }
        });
      });
      setSubmitStatus('Generating proof & submitting…');
      const name = displayMode === DisplayMode.PUBLIC
        ? address!.slice(0, 12) + '..' + address!.slice(-12)
        : displayMode === DisplayMode.CUSTOM ? customName : undefined;
      await result.api.submitScore(lastScore, name);
      setSubmitting(false); setSubmitStatus(null);
      setShowResult(false); setLastScore(0);
      setTimeout(() => refreshLeaderboard(), 3000);
    } catch (e: any) {
      setSubmitting(false); setSubmitStatus(null);
      setError(friendlyError(e));
    }
  }, [wallet, lastScore, displayMode, customName, contractAddress, refreshLeaderboard]);

  // ── Verify ownership (ZK proof — private, not stored on-chain) ────────

  const verifyEntry = useCallback(async (entryId: number) => {
    if (!wallet) return;
    setVerifyingId(entryId);
    setError(null);
    try {
      const logger = pino({ level: 'warn', browser: { asObject: true } });
      const manager = new BrowserLeaderboardManager(logger);
      const deployment$ = manager.resolve(contractAddress as any);
      const result = await new Promise<any>((resolve, reject) => {
        const sub = deployment$.subscribe((d) => {
          if (d.status === 'deployed') { sub.unsubscribe(); resolve(d); }
          if (d.status === 'failed') { sub.unsubscribe(); reject(d.error); }
        });
      });
      await result.api.verifyOwnership(entryId);
      setVerifiedIds(prev => new Set(prev).add(entryId));
    } catch (e: any) {
      setError(friendlyError(e));
    } finally {
      setVerifyingId(null);
    }
  }, [wallet, contractAddress]);

  // ── Render ───────────────────────────────────────────────────────────

  const isConnected = walletState === 'connected';

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="title">Midnight Leaderboard</span>
        </div>
        <div className="header-right">
          {isConnected && address ? (
            <div className="chip"><span className="dot" />{truncAddr(address)}</div>
          ) : walletState === 'detecting' || walletState === 'connecting' ? (
            <div className="chip muted"><span className="spinner" />{walletState === 'detecting' ? 'Detecting…' : 'Connecting…'}</div>
          ) : walletState === 'no-wallet' ? (
            <a className="chip warn" href="https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk" target="_blank" rel="noopener noreferrer">Install Lace →</a>
          ) : (
            <button className="btn-connect" onClick={connect}>Connect Wallet</button>
          )}
        </div>
      </header>

      {error && (
        <div className="error-bar">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <main className="game-layout">
        <section className="card game-card">
          <div className="contract-bar">
            <button className="contract-addr" onClick={handleCopy} title={`Click to copy: ${contractAddress}`}>
              <span className="mono">{truncAddr(contractAddress)}</span>
              <span className="copy-icon">{copied ? '✓' : '⎘'}</span>
            </button>
            <button className="btn-text" onClick={() => setShowJoinPanel(!showJoinPanel)}>
              {showJoinPanel ? 'Cancel' : 'Switch'}
            </button>
          </div>

          {showJoinPanel && (
            <div style={{ marginBottom: 16 }}>
              <input className="input" type="text" placeholder="Contract address (64 hex chars)"
                value={joinInput} onChange={e => setJoinInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinContract()} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" onClick={joinContract} disabled={!joinInput.trim()} style={{ flex: 1 }}>
                  Join Contract
                </button>
                {isConnected ? (
                  <button className="btn-secondary" onClick={deployContract} disabled={deploying} style={{ flex: 1 }}>
                    {deploying ? <><span className="spinner" /> Deploying…</> : 'Deploy New'}
                  </button>
                ) : (
                  <button className="btn-secondary" onClick={connect} disabled={walletState !== 'ready'} style={{ flex: 1 }}>
                    Connect to Deploy
                  </button>
                )}
              </div>
            </div>
          )}

          <h2>Click Challenge</h2>
          <p className="dim">Click as fast as you can in 10 seconds.</p>

          <div className="game-area">
            <div className="timer-ring">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" className="timer-track" />
                <circle cx="50" cy="50" r="44" className="timer-fill"
                  style={{ strokeDasharray: `${2 * Math.PI * 44}`, strokeDashoffset: `${2 * Math.PI * 44 * (1 - timeLeft / 10)}` }} />
              </svg>
              <div className="timer-label">{isPlaying ? timeLeft : showResult ? '✓' : '10'}</div>
            </div>
            <div className="click-score">
              <span className="big-num">{fmtScore(clicks)}</span>
              <span className="dim small">clicks</span>
            </div>
            <div className="click-zone">
              {isPlaying ? (
                <button className="btn-click" onPointerDown={handleClick}>CLICK!</button>
              ) : (
                <div className="click-spacer" />
              )}
            </div>
          </div>

          {showResult && !isPlaying && (
            <div className="result-bar">
              <button className="btn-secondary btn-sm" onClick={startGame}>Try Again</button>
            </div>
          )}

          {!isPlaying && !showResult && (
            <div className="start-bar">
              <button className="btn-secondary" onClick={startGame}>Start Game</button>
            </div>
          )}

          {lastScore > 0 && !isPlaying && (
            <div className="submit-section">
              <div className="mode-row">
                {([[DisplayMode.ANONYMOUS, '🎭 Anonymous'], [DisplayMode.PUBLIC, '👁 Public'], [DisplayMode.CUSTOM, '✏️ Custom']] as const).map(([m, label]) => (
                  <button key={m} className={`mode-btn ${displayMode === m ? 'active' : ''}`} onClick={() => setDisplayMode(m)}>{label}</button>
                ))}
              </div>
              {displayMode === DisplayMode.CUSTOM && (
                <input className="input" type="text" placeholder="Display name (max 32)" maxLength={32}
                  value={customName} onChange={e => setCustomName(e.target.value)} />
              )}
              {isConnected ? (
                <button className="btn-primary" onClick={submitScore}
                  disabled={submitting || (displayMode === DisplayMode.CUSTOM && !customName.trim())}>
                  {submitting ? <><span className="spinner" /> {submitStatus}</> : 'Submit to Chain'}
                </button>
              ) : (
                <button className="btn-primary" onClick={connect} disabled={walletState !== 'ready'}>
                  {walletState === 'no-wallet' ? 'Install Lace to Submit' : 'Connect Wallet to Submit'}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card lb-card">
          <div className="lb-header">
            <h2>Leaderboard</h2>
            <span className="dim mono">{leaderboard.length} entries</span>
          </div>
          {leaderboard.length === 0 ? (
            <div className="lb-empty"><p className="dim">No scores yet. Be the first to submit!</p></div>
          ) : (
            <>
              <div className="lb-row lb-head">
                <span className="lb-rank">#</span>
                <span className="lb-name">Player</span>
                <span className="lb-score">Score</span>
              </div>
              <div className="lb-table">
              {leaderboard.map(e => (
                <div key={`${e.rank}-${e.id}`} className={`lb-row ${e.rank <= 3 ? 'lb-top' : ''}`}>
                  <span className="lb-rank">{e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank}</span>
                  <span className="lb-name">
                    {e.displayName}
                    {verifiedIds.has(e.id) && <span className="verified-tag">✓ yours</span>}
                  </span>
                  <span className="lb-score mono">
                    {fmtScore(e.score)}
                    {isConnected && (
                      <button className="btn-verify" onClick={() => verifyEntry(e.id)}
                        disabled={verifyingId !== null || verifiedIds.has(e.id)}
                        style={{ visibility: verifiedIds.has(e.id) ? 'hidden' : 'visible' }}
                        title="Prove this entry is yours via ZK proof">
                        {verifyingId === e.id ? <span className="spinner" /> : 'Prove'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Built on <a href="https://midnight.network" target="_blank" rel="noopener noreferrer">Midnight</a></span>
      </footer>
    </div>
  );
}
