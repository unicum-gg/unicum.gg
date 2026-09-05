---
term: Hunter rating
aliases:
  - HR
  - steel hunter rating
related:
  - steel-hunter
  - win-rate
  - hrb
links:
  - target: steel-hunter
anchors:
  labels:
    - HR
    - Hunter rating
---

The Steel Hunter performance rating used on unicum.gg, built from average experience per battle and win rate, discounted for small samples.

Steel Hunter is a battle royale, so the usual damage-based ratings do not transfer: placement matters as much as damage, and the mode's own experience formula already folds in damage, frags, spotting, survival time and where the player finished.

HR therefore uses two axes. Average experience per battle is the effectiveness signal, win rate is the outcome, and each is normalised against the population median before being weighted equally.

A volume discount then scales the result, so an account with a handful of lucky runs cannot sit on top of the leaderboard ahead of players with hundreds of battles.
