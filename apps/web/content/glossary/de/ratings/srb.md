---
term: Gefechtsbasierte Festungswertung
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

Die Festungswertung, bei der die Anzahl der Gefechte belohnt und nicht nur als Voraussetzung gewertet wird, sodass ein Clan, der sich über Hunderte von Gefechten bewährt hat, höher eingestuft wird als einer mit derselben SR nach zwanzig Gefechten.

Die SR ignoriert bewusst, wie viel ein Clan spielt. Die SRB übernimmt dieselbe Wertung und multipliziert sie mit einem Faktor, der mit der Anzahl der absolvierten Gefechte wächst, sodass sie stets höher sein kann als die SR, auf der sie basiert.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logarithmisch, daher sind die ersten hundert Gefechte weitaus mehr wert als das tausendste. ```

Bewusst gilt für jede Stufe dieselbe Volumenkonstante: Scharmützel der Stufe X werden durchgehend gespielt, während Vorstöße nur einige Wochen im Jahr phasenweise stattfinden, sodass die tatsächlich häufiger gespielten Stufen einen größeren Bonus erhalten. Der Volumenbonus unterscheidet einen Clan, der eine Wertung über Hunderte von Gefechten gehalten hat, von einem Clan, der sie nach zwanzig Gefechten erreicht hat.
