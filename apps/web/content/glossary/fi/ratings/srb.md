---
term: Taistelumäärään perustuva Linnoitus-luokitus
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

Linnoitus-luokitus, jossa taistelumäärä palkitaan pelkän vähimmäisvaatimuksen sijaan, joten sadoissa taisteluissa tasonsa osoittanut klaani sijoittuu korkeammalle kuin klaani, jolla on sama SR vain kahdenkymmenen taistelun jälkeen.

SR jättää tarkoituksella huomiotta sen, kuinka paljon klaani pelaa. SRB kertoo saman luokituksen tekijällä, joka kasvaa käytyjen taistelujen määrän mukana, joten se voi olla vain suurempi kuin pohjana oleva SR.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritminen, joten ensimmäiset sata taistelua ovat paljon arvokkaampia kuin tuhannes. ```

Tarkoituksella sama taistelumäärän vakio kaikilla tasoilla: tason X Kahakkaa pelataan jatkuvasti, kun taas Hyökkäysoperaatioita pelataan muutaman viikon jaksoissa vuoden aikana, joten enemmän pelatut tasot saavat suuremman bonuksen. Taistelumääräbonus erottaa klaanin, joka on säilyttänyt luokituksensa satojen taistelujen ajan, klaanista, joka saavutti sen kahdessakymmenessä taistelussa.
