---
term: WNX
aliases:
  - WNX rating
  - WNX ocena
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

Moderni ocena za posamezen tank, ki šteje pomoč škodo poleg povzročene škode in popolnoma opusti termin o zmagi.

WNX ohranja obliko WN8, razmerja do pričakovanih vrednosti za posamezne tanke, in spremeni, kaj šteje. Sledenje in radijska pomoč sta dodana škodi v dveh tretjinah njune vrednosti, tako da se zaznavanje sovražnikovega tanka za zavezništvo in blokiranje sledi ocenita kot prispevek, ki sta, namesto da bi ju zanemarili.

Nima komponente zmage. Izraz na osnovi rezultata nagrajuje platoonanje in dolgotrajne račune bolj, kot meri igralca, zato WNX oceni le tisto, kar je igralec storil v bitki: škoda plus pomoč, ubijanja in opažanja v primerjavi s tistim, kar se od tanka pričakuje, da bo proizvedel.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Opomba: Ta formula je zasnovana tako, da nagrajuje večji doseg med dobrim in izjemnim računom. ```

Pričakovane vrednosti prihajajo iz tomato.gg, ki jih preračunava na podlagi velikega vzorca spremljanih računov. To je privzet ocena na unicum.gg, ker se najhitreje odzove na način, kako se tank danes dejansko igra.
