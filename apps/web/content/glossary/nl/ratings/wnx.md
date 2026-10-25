---
term: WNX
aliases:
  - WNX rating
  - WNX-beoordeling
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

Een moderne beoordeling per voertuig die assistentieschade meetelt naast toegebrachte schade en de term winrate volledig weglaat.

WNX behoudt de opbouw van WN8, de verhoudingen ten opzichte van verwachte waarden per voertuig, en verandert wat het meetelt. Rupsband- en radioassistentie worden voor twee derde van hun waarde aan de schade toegevoegd, zodat het spotten voor een bondgenoot en het blokkeren van een rupsband worden gewaardeerd als de bijdrage die ze werkelijk leveren, in plaats van te worden genegeerd.

WNX heeft geen winratecomponent. Termen die op resultaten zijn gebaseerd, belonen het spelen in pelotons en lange accountgeschiedenissen meer dan ze de speler meten, dus WNX beoordeelt alleen wat de speler in de strijd heeft gedaan: schade plus assistentie, vernietigde voertuigen en gespotte voertuigen, afgezet tegen wat het voertuig naar verwachting hoort te produceren.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

De exponent aan het einde rekt de bovenkant van de schaal uit, zodat het verschil tussen een goed en een uitzonderlijk account zichtbaar blijft in plaats van te worden samengedrukt. ```

De verwachte waarden worden opnieuw berekend op basis van een grote steekproef van gevolgde accounts. Dit is de standaardbeoordeling op unicum.gg, omdat deze het snelst reageert op hoe een voertuig tegenwoordig daadwerkelijk wordt gespeeld.
