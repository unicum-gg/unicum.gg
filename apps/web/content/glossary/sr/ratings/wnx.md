---
term: WNX
aliases:
  - WNX rejting
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

Savremeni rejting po vozilima koji računa asistencijsku štetu pored štete nanošene i potpuno uklanja termin procenta pobeda.

WNX zadržava oblik WN8, odnos prema očekivanim vrednostima po vozilu i menja ono što računa. Praćenje i radio pomoć dodaju se šteti sa dve trećine svoje vrednosti, tako da otkrivanje neprijatelja za saveznika i blokiranje gusenice se boduju kao doprinos koji jesu umesto da budu ignorisani.

Ne sadrži komponentu procenta pobeda. Izrazi zasnovani na ishodu nagrađuju platoone i duge naloge više nego što mere igrača, tako da WNX boduje samo ono što je igrač učinio u bitci: šteta plus pomoć, fragovi i spotovi u odnosu na ono što se od vozila očekuje da proizvede.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Ekspozent na kraju rasteže vrh skale, tako da razlika između dobrog i izuzetnog naloga ostaje vidljiva umesto da se kompresuje. ```

Očekivane vrednosti dolaze sa tomato.gg, koji ih preračunava na osnovu velikog uzorka praćenih naloga. Ovo je podrazumevani rejting na unicum.gg jer najbrže reaguje na to kako se vozilo zapravo igra danas.
