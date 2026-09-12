---
term: Gefechtbasierte Festungswertung
aliases:
  - SRB
  - Festungswertung nach Gefechtsanzahl
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

Die Festungswertung, bei der die Gefechtsanzahl belohnt wird, statt lediglich als Schwellenwert zu dienen, sodass ein Clan, der sich über Hunderte von Gefechten bewährt hat, höher eingestuft wird als einer mit demselben SR nach zwanzig Gefechten.

SR ignoriert bewusst, wie viel ein Clan spielt. SRB verwendet dieselbe Wertung und multipliziert sie mit einem Faktor, der mit der Zahl der zugrunde liegenden Gefechte wächst, sodass sie immer nur höher sein kann als der SR, auf dem sie basiert.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logarithmisch, daher sind die ersten hundert Gefechte weit mehr wert als das tausendste. ```

Bewusst eine einzige Volumenkonstante für jede Stufe: Scharmützel der Stufe X werden kontinuierlich gespielt, während Vorstöße nur einige Wochen im Jahr in Schüben stattfinden, sodass die Stufen, die tatsächlich häufiger gespielt werden, einen größeren Bonus erhalten. Es ist dieselbe Idee wie bei HRB neben HR in der Bestenliste von Stählerner Jäger.
