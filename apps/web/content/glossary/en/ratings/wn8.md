---
term: WN8
aliases:
  - WN8 rating
  - wn8 score
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

A community performance rating that scores a player against the damage, kills, spotting and base defence expected of the vehicles they actually play, with a win rate term on top.

WN8 answers a question a raw average cannot. Is 1,800 damage per battle good? On a Tier X heavy it is unremarkable, on a Tier V medium it is exceptional. WN8 compares every vehicle on an account against the server average for that same vehicle, so a player who mostly drives Tier VI is measured against Tier VI rather than against the whole population.

It was published in 2013 by the WN team as the successor to WN7, whose tier penalty made it easy to game. Five ratios feed it: damage, frags, spotting, dropped capture points and win rate, each divided by the expected value for the vehicles played, floored at zero and capped against the damage term so a single strong axis cannot carry the rest.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Each ratio here is the corrected form: the raw ratio shifted by its floor, clamped to the damage ratio it multiplies.
```

Damage carries roughly three quarters of the weight, which is the usual complaint about it: a passive player who farms damage from the back scores better than the numbers deserve. The win rate term is capped at 1.8 so a strong platoon cannot inflate a weak account indefinitely.

Because the expected values are a snapshot of the server, WN8 drifts as the population and the vehicles change. A tank that gets buffed raises the bar for everyone driving it at the next dataset update. WN8 is also cumulative over an account's entire history, so a few thousand early battles keep weighing on it years later, which is why most players watch their recent WN8 instead.
