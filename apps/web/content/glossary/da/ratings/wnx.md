---
term: WNX
aliases:
  - WNX rating
  - WNX vurdering
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

En moderne bedømmelse pr. køretøj, der tæller hjælpe-skade sammen med dealt skade og helt dropper vindraten helt.

WNX bevarer WN8's struktur, forhold imod forventede værdier pr. køretøj, og ændrer hvad den tæller. Tracking og radio assistance tilføjes til skade med to tredjedele af deres værdi, så spotting for en allieret og blokering af et spor scores som det bidrag, de er, i stedet for at blive ignoreret.

Den har ingen vindrate-komponent. Resultatbaserede termer belønner platooning og lange konti mere end de måler spilleren, så WNX scorer kun hvad spilleren gjorde i slaget: skade plus assistance, frags og spots imod hvad køretøjet forventes at producere.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Tail eksponenten strækker toppen af skalaen, så forskellen mellem en god og en exceptionel konto forbliver synlig i stedet for at blive komprimeret. ```

De forventede værdier kommer fra tomato.gg, som genberegner dem fra et stort udvalg af sporede konti. Dette er den standardbedømmelse på unicum.gg fordi den reagerer hurtigst på hvordan et køretøj faktisk spilles i dag.
