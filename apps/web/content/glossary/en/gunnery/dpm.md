---
term: Damage per minute
aliases:
  - DPM
  - sustained damage
related:
  - alpha-damage
  - reload
  - rate-of-fire
  - dpg
anchors:
  specKeys:
    - dpm
  labels:
    - DPM
---

How much a gun deals over a sustained exchange, alpha multiplied by how often it can fire.

DPM is the sustained counterpart to alpha. It answers what a gun produces if it never stops firing, which is what decides a long brawl where both vehicles are trading in the open.

```formula
DPM = alpha x 60 / reload

On a magazine gun the whole cycle counts: the clip's damage divided by the time to fire it and reload it.
```

It is a ceiling, not a measurement. Nobody fires on cooldown for a full minute: aiming, repositioning and waiting for a target all cut into it, so a gun with the best DPM on paper often loses to one that hits harder per shot.

Crew skills, equipment and consumables all raise it, which is why the figure shown for a stock configuration and the figure a fully equipped vehicle reaches can differ by a fifth or more.
