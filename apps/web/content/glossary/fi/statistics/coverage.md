---
term: Peitto
aliases:
  - tracked accounts
  - seuranta peitto
related:
  - session
  - expected-values
links:
  - target: coverage
---

Kuinka suuri osa palvelimen pelaajapopulaatiosta tilastopalvelu seuraa ja kuinka tuoreita kyseiset tilit ovat.

Yksikään tracker ei näe jokaista tiliä. Wargamingin API on rajoitettu, joten sivusto löytää tilejä klaaniluetteloiden ja hakujen kautta, ja päivittää sitten jokaisen tilin sisäänkäynnin mukaisesti. Peitto on aktiivisten pelaajien osuus alueella, jota se kattaa, ja kuinka äskettäin kukin tili on päivitetty.

Tämä on tärkeää, koska jokainen tulostaulu ja jokainen palvelimen keskiarvo lasketaan seuraavasta populaatiosta, ei koko palvelimesta. Laaja peitto tekee näistä luvuista edustavia, kapea peitto tekee niistä otannan.
