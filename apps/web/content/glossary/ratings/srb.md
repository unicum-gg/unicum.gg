---
term: Battles-based Stronghold Rating
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - hr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

The Stronghold Rating with battle volume rewarded rather than merely gated, so a clan that has proven itself over hundreds of battles ranks above one with the same SR over twenty.

SR deliberately ignores how much a clan plays. SRB takes that same rating and multiplies it by a term that grows with the battles behind it, so it can only ever be higher than the SR it is built on.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logarithmic, so the first hundred battles are worth far more than the thousandth.
```

One volume constant across every tier, on purpose: Skirmish Tier X is played continuously while Advances runs in bursts a few weeks a year, so the tiers that really are played more earn a bigger bonus. It is the same idea as HRB next to HR on the Steel Hunter board.
