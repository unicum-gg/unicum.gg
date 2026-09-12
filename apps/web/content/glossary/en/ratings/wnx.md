---
term: WNX
aliases:
  - WNX rating
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

A modern per-vehicle rating that counts assistance damage alongside damage dealt and drops the win rate term entirely.

WNX keeps WN8's shape, ratios against per-vehicle expected values, and changes what it counts. Tracking and radio assistance are added to damage at two thirds of their value, so spotting for an ally and blocking a track are scored as the contribution they are rather than being ignored.

It has no win rate component. Outcome-based terms reward platooning and long accounts more than they measure the player, so WNX scores only what the player did in the battle: damage plus assistance, frags and spots against what the vehicle is expected to produce.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

The tail exponent stretches the top of the scale, so the gap between a good and an exceptional account stays visible instead of compressing.
```

The expected values come from tomato.gg, which recomputes them from a large sample of tracked accounts. This is the default rating on unicum.gg because it reacts fastest to how a vehicle is actually played today.
