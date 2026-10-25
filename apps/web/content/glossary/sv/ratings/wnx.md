---
term: WNX
aliases:
  - WNX-betyg
  - WNX rating
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

Ett modernt fordonsbaserat betyg som räknar assistansskada tillsammans med utdelad skada och helt tar bort segerprocenten.

WNX behåller WN8:s form och kvoter mot förväntade värden för varje fordon, men ändrar vad som räknas. Band- och radioassistans läggs till skadan med två tredjedelar av sitt värde, så att spaning för en allierad och blockering av ett band bedöms som det bidrag de faktiskt är i stället för att ignoreras.

Det har ingen segerprocentkomponent. Resultatbaserade termer belönar plutonspel och konton med lång historik mer än de mäter spelaren, så WNX räknar bara det spelaren gjorde i striden: skada plus assistans, frags och upptäckter jämfört med vad fordonet förväntas åstadkomma.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Exponentens slutled sträcker ut skalans topp, så skillnaden mellan ett bra och ett exceptionellt konto förblir synlig i stället för att komprimeras. ```

De förväntade värdena räknas om från ett stort urval av spårade konton. Detta är standardbetyget på unicum.gg eftersom det reagerar snabbast på hur ett fordon faktiskt spelas i dag.
