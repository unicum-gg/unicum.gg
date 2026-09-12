---
term: Battles-baseret Stronghold Vurdering
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

Stronghold Vurdering med kamp volumen belønnet snarere end blot begrænset, så en klan som har bevist sig selv over hundrede kampe rangerer højere end en med den samme SR over tyve.

SR ignorerer bevidst hvor meget en klan spiller. SRB tager den samme vurdering og multiplikerer den med et begreb der vokser med kampene bag sig, så det kun kan være højere end den SR det er bygget på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, så de første hundrede kampe er meget mere værd end den tusinde. ```

En volumen konstant på tværs af hver tier, med vilje: Skirmish Tier X spilles kontinuerligt mens Advances kører i stød et par uger om året, så de tiers der virkelig spilles mere får en større bonus. Det er den samme idé som HRB ved siden af HR på Steel Hunter tavlen.
