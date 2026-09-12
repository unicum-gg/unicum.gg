---
term: WNX
aliases:
  - WNX rating
  - WNX beoordeling
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

Een moderne beoordeling per voertuig die assistentie schade telt naast de schade die is toegebracht en de winratio term volledig laat vallen.

WNX behoudt de structuur van WN8, verhoudingen tegen verwachte waarden per voertuig, en verandert wat het telt. Tracking en radio-assistentie worden aan schade toegevoegd tegen twee derde van hun waarde, zodat spotten voor een bondgenoot en het blokkeren van een track worden geteld als de bijdrage die ze zijn in plaats van genegeerd te worden.

Het heeft geen winratio-component. Resultaatgebaseerde termen belonen platooning en lange accounts meer dan ze de speler meten, dus WNX scoort alleen wat de speler deed in de strijd: schade plus assistentie, frags en spots tegen wat het voertuig is verwacht te produceren.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

De tail exponent strekt de top van de schaal uit, zodat de kloof tussen een goed en een uitzonderlijk account zichtbaar blijft in plaats van samengedrukt te worden. ```

De verwachte waarden komen van tomato.gg, die ze opnieuw berekent op basis van een grote steekproef van bijgehouden accounts. Dit is de standaard beoordeling op unicum.gg omdat het het snelst reageert op hoe een voertuig vandaag de dag daadwerkelijk wordt gespeeld.
