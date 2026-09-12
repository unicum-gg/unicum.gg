---
term: Erődítmény Értékelés
aliases:
  - SR
  - hadjárat értékelés
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

Az Erődítmény teljesítményértékelést a unicum.gg használja: a roster erőssége szorozva azzal, hogy egy klán mennyivel nyer a minimumhoz képest, a megerősített rosterek levonva. 

Az Erődítmény eredmények nehezen összehasonlíthatók, mert egy klán választhatja meg az ellenfél csapatát és a mennyiséget. Az SR egy szűkebb kérdésre ad választ: milyen jó ez a roster, és nyer-e vele. 

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength is the median Personal Rating of the clan above 4,500. The median, not the mean: it shrugs off both the low tail of small accounts and a couple of carries. ```

A roster erősségét egy versenyképes küszöb fölött mérik, nem pedig nulláról kezdve, így a különbség egy átlagos roster és egy elit között a domináló tényező. A nyerési tényező neutrálnak számít 50%-nál, és szuper-linearisan viselkedik, így a dominálás többet ér, mint a kis előny.

Az utolsó tényező az anti-farming. Az Erődítmények, különösen az Előrehaladások, megerősített fiókokkal játszanak: olyan kis fiókok, amelyek szinte nincs random csatáik, és csak ahhoz szükségesek, hogy megtöltsenek egy erődítmény rosteret. Az ilyen fiókok hiánya nem kamuflázható, így egy ilyen fiókokkal teli roster le van mérve.

A mennyiség egyáltalán nem szerepel, ami tiszta készségértékeléssé teszi. Egy csata küszöb megakadályozza, hogy egy szerencsés néhány játék elérje a ranglistát, és az SRB az a testvér, amely a mennyiséget jutalmazza.
