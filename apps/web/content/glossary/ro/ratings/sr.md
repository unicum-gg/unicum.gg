---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
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

Ratingul de performanță al Stronghold-ului utilizat pe unicum.gg: puterea roster-ului înmulțită cu cât de mult o clană câștigă peste media generală, cu rostele boostate discountate.

Rezultatele Stronghold-ului sunt greu de comparat deoarece o clană își alege opoziția și volumul. SR răspunde la o întrebare mai îngustă: cât de bun este acest roster și câștigă cu el.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength este mediana Personal Rating a clanului deasupra 4,500. Mediana, nu media: aceasta ignoră atât coada joasă a conturilor mici cât și câteva cărări. ```

Puterea roster-ului este măsurată deasupra unei baze competitive mai degrabă decât de la zero, astfel că diferența între un roster mediu și unul de elită este termenul dominant. Factorul de câștig este neutru la 50% și super-liniar, astfel că a domina valorează mai mult decât a câștiga strâns.

Ultimul termen este cel anti-farming. Stronghold-urile, în special Advances, sunt jucate cu conturi boostate: conturi mici cu aproape deloc bătălii aleatorii care există doar pentru a umple un roster de stronghold. Această absență nu poate fi falsificată, așa că un roster plin de acestea este redus.

Volumul nu este deloc inclus, ceea ce îl face un rating pur de abilități. O bază de bătălie menține un număr norocos de jocuri departe de clasamente,iar SRB este fratele care recompensează volumul.
