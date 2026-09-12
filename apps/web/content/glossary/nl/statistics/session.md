---
term: Session
aliases:
  - session stats
  - dagelijkse stats
related:
  - recent-stats
  - battles
  - coverage
---

Een blok van gevechten gespeeld in één zitting, gereconstrueerd door een tracker uit het verschil tussen twee snapshots van een account.

Wargaming's API levert de totalen van een account, niet de individuele gevechten. Een tracker maakt regelmatig snapshots van die totalen, en het verschil tussen twee snapshots is precies de gevechten die in de tussentijd zijn gespeeld, met hun schade, kills en resultaten.

Dat verschil is een sessie. Het is hoe een site kan laten zien wat een speler vandaag heeft gedaan in plaats van wat zij sinds 2013 hebben gedaan, en het is waar recente beoordelingen over worden berekend.

De resolutie hangt af van hoe vaak het account wordt gesnapshot, dus een sessie is een blok van spelen in plaats van een nauwkeurige start- en eindtijd, en een gevecht dat net vóór een snapshot is gespeeld, valt in de sessie van die snapshot.
