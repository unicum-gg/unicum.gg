---
term: Session
aliases:
  - session stats
  - daglige stats
related:
  - recent-stats
  - battles
  - coverage
---

Et blok af kampe spillet i én omgang, rekonstrueret af en tracker fra forskellen mellem to snapshots af en konto.

Wargamings API leverer en kontos totaler, ikke dens individuelle kampe. En tracker tager snapshots af disse totaler regelmæssigt, og forskellen mellem to snapshots er præcis de kampe, der er spillet imellem, med deres skade, drab og resultater.

Den forskel er en session. Det er, hvordan et site kan vise, hvad en spiller har gjort i dag i stedet for hvad de har gjort siden 2013, og det er hvad de seneste vurderinger beregnes over.

Dens opløsning afhænger af, hvor ofte kontoen tages snapshot af, så en session er et blok af spil snarere end et præcist start- og sluttidspunkt, og en kamp spillet lige før et snapshot falder inden for det snapshot’s session.
