---
term: Battles-based Stronghold Rating
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - hr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Stronghold reitingas, vertinamas pagal kovų apimtį, o ne tiesiog apribojamas, todėl klanas, kuris įrodė savo galią per šimtus kovų, užima aukštesnę vietą nei tas, kuris turi tą patį SR per dvidešimt.

SR sąmoningai ignoruoja, kiek klanas žaidžia. SRB paima tą patį reitingą ir padaugina jį iš termino, kuris auga kartu su už jo esančiomis kovomis, todėl jis visada bus didesnis nei SR, kurio pagrindu jis buvo sukurtas.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritminis, todėl pirmos šimtos kovos vertos žymiai daugiau nei tūkstantoji. ```

Vienas apimties konstantas visose pakopose, tyčia: Skirmish Tier X žaidžiamas nuolat, kol Advances vyksta per kelias savaites per metus, todėl tos pakopos, kurios tikrai žaidžiamos daugiau, gauna didesnį priedą. Tai ta pati idėja kaip HRB šalia HR Steel Hunter lentelėje.
