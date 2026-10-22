---
term: Mode rating
aliases:
  - MR
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

The performance rating unicum.gg uses for the battle modes outside Random Battles, built from average experience per battle and win rate, each read against the median of the people who play that mode.

WN7, WN8 and WNX cannot be used there. All three are built against an expected damage figure measured in random battles, so a Stronghold Skirmish is scored as a random battle nobody could have played: the mode is shorter and tier-limited, which puts a good player's damage at a fraction of their random average while their win rate sits near 90%. Measured on one vehicle, the same player scored 1,794 WNX in Skirmish against 4,708 in Random, at 89.5% wins against 71.9%. The honest answer is not a corrected WN8 but a different question, and MR asks it: how does this player compare to the people who play this mode.

It uses two axes. Average experience per battle is the effectiveness signal, because the game's own experience formula already folds in damage, frags, spotting and survival time, so separate axes would count the same battle twice. Win rate is the outcome. Each is divided by the mode's own median, they are weighted equally, and a volume term then discounts a small sample so a hundred battles cannot top a ranking ahead of someone with thousands.

One last division is what makes the number portable: the score is scaled by the mode's own median score, so **1000 is the median player in every mode**. Without it the modes would not be comparable even after normalising the two axes, because the volume term reads a battle count and the modes are played in wildly different volumes: measured on EU, the median score ran from 893 in Clan Wars VI to 1300 in Skirmish, which would paint an average Skirmish player green and an average player elsewhere orange for the same standing.

What MR does not claim is a comparison with WN8. Those rate a player against the whole playerbase; MR rates them against a self-selected group, and a mode that attracts strong players has a higher bar than one that does not. It says where you stand among the people you actually meet there.
