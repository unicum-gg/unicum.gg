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

Moderni rejting po vozilima koji računa pomoćnu štetu pored nanesene štete i potpuno eliminiše termin stope pobjeda.

WNX zadržava strukturu WN8, omjere prema očekivanim vrijednostima za svako vozilo, i mijenja ono što računa. Praćenje i radio pomoć se dodaju šteti u dvije trećine njihove vrijednosti, tako da je otkrivanje neprijatelja za saveznika i blokiranje točka ocjenjeno onako kako zapravo doprinosi umjesto da bude ignorisano.

Nema komponentu stope pobjeda. Izrazi koji se oslanjaju na ishod nagrađuju platoone i duge naloge više nego što mjere igrača, tako da WNX računa samo ono što je igrač uradio u borbi: šteta plus pomoć, fragi i otkrivanja u odnosu na ono što se od vozila očekuje da proizvede.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Tail eksponent rasteže vrh skale, tako da razlika između dobrog i izuzetnog naloga ostaje vidljiva umjesto da se kompresuje. ```

Očekivane vrijednosti dolaze sa tomato.gg, koja ih preračunava iz velikog uzorka praćenih naloga. Ovo je podrazumijevajući rejting na unicum.gg jer najbrže reaguje na način na koji se vozilo trenutno igra.
