---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

The Stronghold performance rating used on unicum.gg: roster strength multiplied by how far above even a clan wins, with boosted rosters discounted.

Stronghold results are hard to compare because a clan chooses its opposition and its volume. SR answers a narrower question: how good is this roster, and does it win with it.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength is the median Personal Rating of the clan above 4,500. The median, not the mean: it shrugs off both the low tail of small accounts and a couple of carries.
```

Roster strength is measured above a competitive floor rather than from zero, so the gap between an average roster and an elite one is the dominant term. The win factor is neutral at 50% and super-linear, so dominating is worth more than edging it.

The last term is the anti-farming one. Strongholds, Advances especially, get played with boost accounts: small accounts with almost no random battles that exist only to fill a stronghold roster. That absence cannot be faked, so a roster full of them is scaled down.

Volume is not in it at all, which is what makes it a pure skill rating. A battle floor keeps a lucky handful of games off the leaderboard, and SRB is the sibling that rewards volume.
