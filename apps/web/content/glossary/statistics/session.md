---
term: Session
aliases:
  - session stats
  - daily stats
related:
  - recent-stats
  - battles
  - coverage
---

A block of battles played in one sitting, reconstructed by a tracker from the difference between two snapshots of an account.

Wargaming's API serves an account's totals, not its individual battles. A tracker snapshots those totals regularly, and the difference between two snapshots is exactly the battles played in between, with their damage, kills and results.

That difference is a session. It is how a site can show what a player did today rather than what they have done since 2013, and it is what recent ratings are computed over.

Its resolution depends on how often the account is snapshotted, so a session is a block of play rather than a precise start and end time, and a battle played right before a snapshot lands in that snapshot's session.
