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

Sodobna ocena za posamezno vozilo, ki poleg povzročene škode upošteva tudi škodo s pomočjo in popolnoma izloči komponento stopnje zmag.

WNX ohranja zasnovo WN8 in razmerja glede na pričakovane vrednosti za posamezno vozilo, spreminja pa to, kar šteje. Škoda zaradi odkrivanja in radijske podpore se k škodi prišteje v višini dveh tretjin svoje vrednosti, zato se odkrivanje nasprotnikov za zaveznika in onemogočanje gosenic ocenjujeta kot dejanski prispevek, namesto da bi bila prezrta.

Ne vsebuje komponente stopnje zmag. Kazalniki, ki temeljijo na izidu, nagrajujejo igranje v vodih in dolgo aktivne račune bolj, kot merijo igralca, zato WNX ocenjuje samo to, kar je igralec naredil v bitki: škodo in škodo s pomočjo, uničenja ter odkrivanja glede na to, kar naj bi vozilo doseglo.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Eksponent na koncu raztegne vrh lestvice, zato razlika med dobrim in izjemnim računom ostane vidna, namesto da bi se skrčila. ```

Pričakovane vrednosti se ponovno izračunajo na podlagi velikega vzorca spremljanih računov. To je privzeta ocena na unicum.gg, ker se najhitreje odziva na to, kako se vozilo dejansko igra danes.
