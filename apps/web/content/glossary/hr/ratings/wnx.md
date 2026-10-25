---
term: WNX
aliases:
  - WNX rating
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

Moderna ocjena po vozilu koja uračunava štetu uz pomoć uz nanesenu štetu i potpuno izostavlja komponentu postotka pobjeda.

WNX zadržava strukturu WN8, omjere prema očekivanim vrijednostima po vozilu i mijenja ono što se uračunava. Pomoć pri praćenju i radijska pomoć dodaju se šteti s dvije trećine svoje vrijednosti, pa se otkrivanje vozila za saveznika i onesposobljavanje gusjenica vrednuju kao doprinos koji doista jesu, umjesto da se zanemaruju.

Nema komponentu postotka pobjeda. Pojmovi utemeljeni na ishodu više nagrađuju igranje u vodu i dugotrajno aktivne račune nego što mjere igrača, pa WNX boduje samo ono što je igrač napravio u bitci: štetu plus pomoć, uništena vozila i otkrivanja u odnosu na ono što se očekuje da će vozilo ostvariti.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Eksponent na kraju rasteže gornji dio ljestvice, pa razlika između dobrog i iznimnog računa ostaje vidljiva umjesto da se smanji. ```

Očekivane vrijednosti ponovno se izračunavaju na temelju velikog uzorka praćenih računa. Ovo je zadana ocjena na stranici unicum.gg jer najbrže reagira na to kako se vozilo danas doista igra.
