---
term: Kampbaseret Højborgsrating
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

Højborgsratingen, hvor antallet af kampe belønnes frem for blot at fungere som adgangskrav, så en klan, der har bevist sit værd gennem hundredvis af kampe, rangerer højere end en klan med samme SR efter tyve kampe.

SR ser bevidst bort fra, hvor meget en klan spiller. SRB tager den samme rating og ganger den med et led, der vokser med antallet af kampe bag den, så den kun kan være højere end den SR, den bygger på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, så de første hundrede kampe er langt mere værd end den tusinde. ```

Én volumenkonstant på tværs af alle niveauer med vilje: Træfning på niveau X spilles løbende, mens Fremrykninger afvikles i perioder nogle få uger om året, så de niveauer, der rent faktisk spilles mere, får en større bonus. Volumenbonussen er det, der adskiller en klan, som har fastholdt en rating gennem hundredvis af kampe, fra en, der nåede den efter tyve.
