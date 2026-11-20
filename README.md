# Midnight Leaderboard (moved)

**This repository is no longer maintained.** The leaderboard example now lives in
[midnight-examples](https://github.com/midnightntwrk/midnight-examples), at
[`examples/leaderboard`](https://github.com/midnightntwrk/midnight-examples/tree/main/examples/leaderboard).
There it is on Ledger 9 (Compact language 0.28, Midnight.js 5) and is tested in CI with the other
examples.

- **Tutorial:** [docs.midnight.network/tutorials/leaderboard](https://docs.midnight.network/tutorials/leaderboard).
  It is now synced from `examples/leaderboard/tutorials` in midnight-examples.
- **Code:** clone midnight-examples and work in `examples/leaderboard`:

  ```bash
  git clone https://github.com/midnightntwrk/midnight-examples.git
  cd midnight-examples
  npm install && npm run compile
  cd examples/leaderboard
  ```

The code in this repository targets Ledger 8 (Compact language 0.23, Midnight.js 4.1.1) and
doesn't work on networks that have moved to Ledger 9. Open issues and pull requests against
[midnight-examples](https://github.com/midnightntwrk/midnight-examples) instead.
