---
term: Session
aliases:
  - session stats
  - daglige statistikker
related:
  - recent-stats
  - battles
  - coverage
---

En blokk av kamper spilt i ett møte, rekonstruert av en tracker fra forskjellen mellom to snapshot av en konto.

Wargaming's API gir totalsummene til en konto, ikke dens individuelle kamper. En tracker tar snapshots av disse totalsummene regelmessig, og forskjellen mellom to snapshots er nøyaktig kampene spilt imellom, med deres skade, drap og resultater.

Den forskjellen er en sesjon. Det er hvordan et nettsted kan vise hva en spiller gjorde i dag i stedet for hva de har gjort siden 2013, og det er hva nylige rangeringer beregnes over.

Oppløsningen avhenger av hvor ofte kontoen blir snapshot-ed, så en sesjon er en blokk av spilling i stedet for et presist start- og sluttidspunkt, og en kamp spilt rett før et snapshot lander i den snapshotens sesjon.
