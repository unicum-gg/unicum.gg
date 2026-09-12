---
term: Battles-based Stronghold Rating
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

A Stronghold értékelés, amely a csaták számán alapul, nem csupán az akadályozásukon.

Az SR szándékosan figyelmen kívül hagyja, hogy egy klán mennyit játszik. Az SRB ezt a besorolást veszi alapul, és megszorozza egy olyan értékkel, amely a mögötte álló csaták számával nő, így ennél fogva mindig magasabb lesz, mint az SR, amelyből kiindul.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmikus, így az első száz csata sokkal értékesebb, mint az ezredik. ```

Egy mennyiségi állandó minden szinten, szándékosan: a Skirmish Tier X folyamatosan játszódik, míg az Advances időszakosan, évente néhány héten keresztül, így azok a szintek, amelyeket valóban többet játszanak, nagyobb bónuszt kapnak. Ugyanez az elképzelés érvényes az HRB-re és az HR-re a Steel Hunter táblán.
