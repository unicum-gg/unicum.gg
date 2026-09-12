---
term: Pokritost
aliases:
  - sledene račune
  - sledilna pokritost
related:
  - session
  - expected-values
links:
  - target: coverage
---

Pokritost je delež igralne populacije strežnika, ki jo dejansko sledi določena statistična stran, ter koliko so ti računi sveži.

Nobena sledilna stran ne vidi vsakega računa. Wargamingova API je omejena glede hitrostnega dostopa, zato stran odkrije račune preko seznamov klanov in iskanj ter nato vsak račun osveži v ritmu, ki si ga lahko privošči. Pokritost je delež aktivnih igralcev v regiji, ki ga ohranja, in koliko nedavno je bil vsak račun posodobljen.

Pomembno je, ker so vse lestvice in povprečja strežnika izračunana na podlagi sledene populacije in ne na celotnem strežniku. Široka pokritost naredi te številke reprezentativne, ozka pokritost pa jih naredi za vzorec.
