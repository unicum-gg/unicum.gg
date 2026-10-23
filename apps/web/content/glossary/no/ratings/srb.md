---
term: Kampbasert festningsrating
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - mr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Festningsratingen der kampmengde belønnes i stedet for bare å være et minstekrav, slik at en klan som har bevist seg gjennom hundrevis av kamper, rangeres høyere enn en med samme SR etter tjue.

SR ser bevisst bort fra hvor mye en klan spiller. SRB tar den samme ratingen og multipliserer den med et ledd som vokser med antallet spilte kamper, slik at den bare kan være høyere enn SR-en den bygger på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, slik at de første hundre kampene er verdt langt mer enn den tusende. ```

Én volumkonstant på tvers av alle nivåer, med hensikt: Trefning på nivå X spilles kontinuerlig, mens Fremrykkinger foregår i perioder noen få uker i året, slik at nivåene som faktisk spilles mer, får en større bonus. Volumbonusen er det som skiller en klan som har opprettholdt en rating gjennom hundrevis av kamper, fra en som nådde den etter tjue.
