---
term: WNX
aliases:
  - WNX ocjena
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

Moderna ocjena po vozilima koja računa štetu pomoći uz štetu koju je igrač nanio i potpuno isključuje termin postotka pobjeda.

WNX zadržava oblik WN8, omjere prema očekivanim vrijednostima po vozilu i mijenja što se broji. Praćenje i radio pomoć dodaju se u štetu u dvije trećine njihove vrijednosti, tako da procjena za saveznika i blokiranje gusjenice imaju svoj doprinos umjesto da budu ignorirani.

Nema komponentu postotka pobjeda. Izrazi koji se temelje na ishodu nagrađuju platoonanje i dugačke račune više nego što mjere igrača, pa WNX ocjenjuje samo ono što je igrač učinio u bitci: šteta plus pomoć, fragovi i procjene u odnosu na ono što se od vozila očekuje.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Eksponent na kraju širi vrh ljestvice, tako da razlika između dobrog i izvanrednog računa ostaje vidljiva umjesto da se komprimira. ```

Očekivane vrijednosti dolaze s tomato.gg, koja ih preračunava iz velikog uzorka praćenih računa. Ovo je defaultna ocjena na unicum.gg jer najbrže reagira na to kako se vozilo zapravo igra danas.
