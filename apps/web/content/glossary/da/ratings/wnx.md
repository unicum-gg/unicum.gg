---
term: WNX
aliases:
  - WNX rating
  - WNX-bedømmelse
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

En moderne bedømmelse for hvert køretøj, der medregner skade ved assistance sammen med uddelt skade og helt fjerner sejrsraten.

WNX beholder WN8's opbygning og forholdstal i forhold til forventede værdier for hvert køretøj, men ændrer, hvad den tæller med. Sporings- og radioassistance lægges til skaden med to tredjedele af deres værdi, så spotting for en allieret og blokering af en larve vurderes som det bidrag, de faktisk er, i stedet for at blive ignoreret.

Den har ingen sejrsratekomponent. Resultatbaserede begreber belønner spil i deling og gamle konti mere, end de måler spilleren, så WNX scorer kun det, spilleren gjorde i kampen: skade plus assistance, ødelagte køretøjer og opdagelser i forhold til det, køretøjet forventes at levere.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Den afsluttende eksponent strækker toppen af skalaen, så forskellen mellem en god og en fremragende konto forbliver synlig i stedet for at blive komprimeret. ```

De forventede værdier genberegnes ud fra et stort udsnit af sporede konti. Dette er standardbedømmelsen på unicum.gg, fordi den reagerer hurtigst på, hvordan et køretøj faktisk spilles i dag.
