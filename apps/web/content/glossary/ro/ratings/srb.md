---
term: Ratingul Fortăreței bazat pe bătălii
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - mr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Ratingul Fortăreței în care volumul de bătălii este recompensat, nu doar folosit drept prag, astfel încât un clan care și-a dovedit valoarea în sute de bătălii se clasează deasupra unuia cu același SR obținut în douăzeci de bătălii.

SR ignoră în mod deliberat cât de mult joacă un clan. SRB folosește același rating și îl înmulțește cu un termen care crește odată cu numărul de bătălii acumulate, astfel încât nu poate fi niciodată mai mic decât SR pe care se bazează.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Creșterea este logaritmică, astfel încât primele o sută de bătălii valorează mult mai mult decât a mia. ```

O singură constantă de volum pentru fiecare nivel, în mod intenționat: Raid de nivel X se joacă permanent, în timp ce Ofensivele au loc în rafale timp de câteva săptămâni pe an, astfel încât nivelurile care chiar sunt jucate mai mult primesc un bonus mai mare. Bonusul de volum este ceea ce diferențiază un clan care a menținut un rating de-a lungul a sute de bătălii de unul care l-a atins în douăzeci.
