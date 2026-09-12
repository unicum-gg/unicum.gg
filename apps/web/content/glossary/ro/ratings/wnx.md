---
term: WNX
aliases:
  - WNX rating
  - evaluare WNX
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

O evaluare modernă pe vehicul care numără daunele de asistență împreună cu daunele cauzate și elimină complet termenul de rată de câștig.

WNX păstrează forma WN8, raporturile față de valorile așteptate pe vehicul și schimbă ceea ce contează. Asistența la urmărire și radio este adăugată la daune la două treimi din valoarea lor, astfel încât detectarea unui aliat și blocarea unui șenilă sunt notate ca contribuția pe care o reprezintă, în loc să fie ignorate.

Nu are o componentă de rată de câștig. Termenii bazați pe rezultat recompensează echipele și conturile lungi mai mult decât măsoară jucătorul, astfel încât WNX notează doar ceea ce a făcut jucătorul în bătălie: daune plus asistență, fragi și spoturi comparativ cu ceea ce vehiculul este așteptat să producă.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Exponentul de la coadă întinde partea de sus a scalei, astfel încât distanța dintre un cont bun și unul excepțional rămâne vizibilă în loc să se comprime. ```

Valorile așteptate provin de la tomato.gg, care le recomputează dintr-un eșantion mare de conturi monitorizate. Aceasta este evaluarea implicită pe unicum.gg deoarece reacționează cel mai rapid la modul în care este jucat efectiv un vehicul astăzi.
