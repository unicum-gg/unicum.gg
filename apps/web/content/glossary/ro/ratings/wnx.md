---
term: WNX
aliases:
  - WNX rating
  - rating WNX
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

Un rating modern per vehicul care contabilizează daunele prin asistență alături de daunele provocate și elimină complet componenta ratei victoriilor.

WNX păstrează structura WN8 și rapoartele față de valorile așteptate pentru fiecare vehicul, dar schimbă ceea ce contabilizează. Asistența prin șenile și prin radio se adaugă la daune cu două treimi din valoarea lor, astfel încât detectarea unui inamic pentru un aliat și blocarea unei șenile sunt punctate drept contribuția pe care o reprezintă, în loc să fie ignorate.

Nu are nicio componentă a ratei victoriilor. Componentele bazate pe rezultate recompensează plutonarea și conturile vechi mai mult decât măsoară jucătorul, așa că WNX punctează doar ceea ce a făcut jucătorul în luptă: daune plus asistență, distrugeri și detectări în raport cu ceea ce se așteaptă ca vehiculul să producă.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Exponentul final extinde partea superioară a scalei, astfel încât diferența dintre un cont bun și unul excepțional rămâne vizibilă în loc să fie comprimată. ```

Valorile așteptate sunt recalculate pe baza unui eșantion mare de conturi urmărite. Acesta este ratingul implicit pe unicum.gg, deoarece reacționează cel mai rapid la modul în care este jucat efectiv un vehicul în prezent.
