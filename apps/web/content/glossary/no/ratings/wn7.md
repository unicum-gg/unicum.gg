---
term: WN7
aliases:
  - WN7 rating
  - WN7 vurdering
related:
  - wn8
  - expected-values
  - average-tier
links:
  - target: top-players
anchors:
  labels:
    - WN7
---

Forløperen til WN8 fra 2012, beregnet fra konto gjennomsnitt og spillerens gjennomsnittlige nivå i stedet for forventede verdier for hvert kjøretøy.

WN7 var den første bredt adopterte fellesskapsvurderingen. Den tar fem konto-gjennomsnitt: frags, skade, spotting, tapte erobringspoeng, og vinstrate, og korrigerer disse med kontoens gjennomsnittlige nivå, siden skade naturlig skalerer med nivå.

Dens svakhet er selve korrigeringen. Nivået er en fast kurve i stedet for en måling av hvert kjøretøy, så det belønner noen nivåer og straffer andre uavhengig av hvordan spilleren presterer, og en lav-nivå konto kan oppblåse sin vurdering ved å klatre. WN8 erstattet den ved å måle mot hvert kjøretøy individuelt.

Den overlever fordi den ikke trenger et eksternt datasett. WN7 kan beregnes fra en kontos egen oppsummering, mens WN8 trenger en oppdatert forventet verditabell, så den fremstår fortsatt som en fallback og en sanity check.
