---
term: WN7
aliases:
  - WN7 rating
related:
  - wn8
  - expected-values
  - average-tier
links:
  - target: top-players
anchors:
  labels:
    - WN7
---

The 2012 predecessor to WN8, computed from account averages and the player's average tier instead of per-vehicle expected values.

WN7 was the first widely adopted community rating. It takes five account-wide averages, frags, damage, spotting, dropped capture points and win rate, and corrects them with the account's average tier, since damage naturally scales with tier.

Its weakness is the correction itself. The tier term is a fixed curve rather than a measurement of each vehicle, so it rewards some tiers and punishes others regardless of how the player performs, and a low-tier account could inflate its rating by climbing. WN8 replaced it by measuring against every vehicle individually.

It survives because it needs no external dataset. WN7 can be computed from an account's own summary, where WN8 needs an up-to-date expected values table, so it still appears as a fallback and a sanity check.
