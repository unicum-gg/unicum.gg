---
term: WNX
aliases:
  - WNX rejting
  - WNX rating
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

Moderna ocjena po vozilu koja uz uračunatu štetu uključuje i štetu od asistencije, a u potpunosti izbacuje komponentu stope pobjeda.

WNX zadržava strukturu WN8 i omjere u odnosu na očekivane vrijednosti po vozilu, ali mijenja ono što se računa. Pomoć pri otkrivanju i radio-asistencija dodaju se šteti u vrijednosti od dvije trećine, pa se otkrivanje protivnika za saveznika i pomoć pri onesposobljavanju gusjenica vrednuju kao doprinos koji zaista predstavljaju, umjesto da se zanemaruju.

Nema komponentu stope pobjeda. Termini zasnovani na ishodu više nagrađuju igranje u vodu i naloge s dugim stažom nego što mjere igrača, pa WNX boduje samo ono što je igrač uradio u bitci: štetu i asistenciju, eliminacije i otkrivanja u odnosu na ono što se očekuje da će vozilo ostvariti.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Završni eksponent rasteže vrh skale, pa razlika između dobrog i izuzetnog naloga ostaje vidljiva umjesto da se sabije. ```

Očekivane vrijednosti ponovo se izračunavaju na osnovu velikog uzorka praćenih naloga. Ovo je zadana ocjena na unicum.gg jer najbrže reaguje na to kako se vozilo zaista igra danas.
