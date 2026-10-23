---
term: Mūšiais pagrįstas Tvirtovės reitingas
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

Tvirtovės reitingas, kuriame atlyginama už mūšių skaičių, o ne tik nustatoma minimali jų riba, todėl šimtus mūšių savo pajėgumą įrodęs klanas užima aukštesnę vietą nei tokį patį SR per dvidešimt mūšių pasiekęs klanas.

SR sąmoningai neatsižvelgia į tai, kiek klanas žaidžia. SRB tą patį reitingą padaugina iš daugiklio, kuris didėja kartu su sužaistų mūšių skaičiumi, todėl jis visada gali būti tik didesnis už SR, kuriuo remiasi.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Augimas logaritminis, todėl pirmasis šimtas mūšių vertas gerokai daugiau nei tūkstantasis. ```

Visoms pakopoms sąmoningai taikoma ta pati mūšių skaičiaus konstanta: X pakopos Išpuoliai žaidžiami nuolat, o Puolimai vyksta pliūpsniais kelias savaites per metus, todėl pakopos, kuriose iš tikrųjų žaidžiama daugiau, gauna didesnį priedą. Mūšių skaičiaus priedas atskiria klaną, kuris išlaikė reitingą per šimtus mūšių, nuo klano, kuris jį pasiekė per dvidešimt.
