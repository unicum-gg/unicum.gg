---
term: Slaget-baserad Ställning
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

Ställningen för Styrkan baseras på antalet strider snarare än enbart kvoten, så en klan som har bevisat sig över hundratals slag rankas över en som har samma SR över tjugo.

SR ignorerar medvetet hur mycket en klan spelar. SRB tar den samma betyg och multiplicerar den med en term som växer med striderna bakom den, så den kan aldrig vara lägre än den SR den bygger på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, så de första hundra striderna är värda mycket mer än den tusende. ```

Ett volymkonstant över varje nivå, med avsikt: Skirmish Tier X spelas kontinuerligt medan Advances spelas sporadiskt under några veckor varje år, så de nivåer som verkligen spelas mer får en större bonus. Det är samma idé som HRB bredvid HR på Steel Hunter-brädet.
