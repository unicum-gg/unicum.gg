---
term: Battles-basert Stronghold Rating
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

Stronghold Rating med kampvolum som belønnes snarere enn bare gates, så en klan som har bevist seg over hundrevis av kamper rangeres høyere enn en med samme SR over tjue.

SR ignorerer bevisst hvor mye en klan spiller. SRB tar den samme rangeringen og multipliserer den med et begrep som vokser med kampene bak, så det kan aldri være lavere enn SR det er bygget på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, så de første hundre kampene er verdt langt mer enn den tusende. ```

En volums konstant på tvers av hvert nivå, med vilje: Skirmish Tier X spilles kontinuerlig mens Advances kjører i utbrudd noen få uker i året, så nivåene som faktisk spilles mer får en større bonus. Det er den samme ideen som HRB ved siden av HR på Steel Hunter-brettet.
