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

Stronghold præstationsvurdering brugt på unicum.gg: roster styrke ganget med hvor langt over gennemsnittet en klan vinder, med forstærkede rosters fratrukket.

Stronghold resultater er svære at sammenligne, fordi en klan vælger sin modstand og sin volumen. SR besvarer et mere snævert spørgsmål: hvor god er denne roster, og vinder den med den.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength er median Personal Rating for klanen over 4.500. Medianen, ikke gennemsnittet: den ignorerer både de lave afrundinger af små konti og et par carries. ```

Roster strength måles over et konkurrencemæssigt bundniveau i stedet for fra nul, så forskellen mellem en gennemsnitlig roster og en elite er den dominerende term. Vinderfaktoren er neutral ved 50% og super-lineær, så dominering er mere værd end blot at edge.

Den sidste term er den anti-farming. Strongholds, især Advances, spilles med boost konti: små konti med næsten ingen random battles, der kun eksisterer for at udfylde en stronghold roster. Den forskydning kan ikke faked, så en roster fyldt med dem skaleres ned.

Volumen er slet ikke inde i det, hvilket gør det til en ren færdighedsvurdering. Et batalje bundniveau holder et heldigt antal spil ude af leaderboard, og SRB er søskende, der belønner volumen.
