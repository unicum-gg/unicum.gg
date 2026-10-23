---
term: Stridsbaserat befästningsbetyg
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

Befästningsbetyget där stridsvolym belönas i stället för att bara vara ett tröskelkrav, så att en klan som har bevisat sig under hundratals strider rankas högre än en med samma SR efter tjugo strider.

SR bortser avsiktligt från hur mycket en klan spelar. SRB tar samma betyg och multiplicerar det med en faktor som växer med antalet bakomliggande strider, så det kan bara bli högre än det SR som det bygger på.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmisk, så de första hundra striderna är värda mycket mer än den tusende. ```

En enda volymkonstant för alla nivåer, helt avsiktligt: Skärmytsling nivå X spelas kontinuerligt medan Offensiver spelas periodvis under några veckor om året, så de nivåer som faktiskt spelas mer får en större bonus. Volymbonusen är det som skiljer en klan som har hållit ett betyg under hundratals strider från en som nådde det efter tjugo.
