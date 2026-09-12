---
term: WN8
aliases:
  - WN8 érték
  - wn8 pontszám
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

A közösségi teljesítményértékelés, amely az aktuális járművek által elvárt sebzés, gyilkosság, észlelés és bázisvédelem ellenében pontozza a játékost, plusz a győzelmi ráta szempontjából.

A WN8 válaszol egy olyan kérdésre, amelyre a nyers átlag nem tud. Jó a 1,800 sebzés csatánként? Egy Tier X nehéz tanknál ez jelentéktelen, egy Tier V közepesnél pedig kiváló. A WN8 az adott fiók minden járművét a szerver átlagához viszonyítja az adott járműre, így aki főleg Tier VI tankokkal játszik, az Tier VI-ot mérik, nem a teljes populáció ellen.

2013-ban tették közzé a WN csapat által a WN7 utódjaként, amelynek tier büntetése lehetővé tette a manipulációt. Öt arány táplálja: sebzés, gyilkosságok, észlelések, leadott bázispontok és győzelmi ráta, mindegyik elosztva az adott járművek elvárt értékével, nullánál nem kevesebb és a sebzés kifejezéshez rögzítve, hogy egy erős tengely ne tudja a többit elvinni.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Minden arány itt a javított forma: a nyers arány a padlóval eltolva, rögzítve a szorzott sebzés arányhoz. ```

A sebzés körülbelül háromnegyed súlyt képvisel, ami a szokásos panasz róla: egy passzív játékos, aki hátulról farmolja a sebzést, jobban teljesít, mint amennyit a számok indokolnának. A győzelmi ráta értéke 1.8-nál van korlátozva, így egy erős kötelék nem tud határtalanul felfújni egy gyenge fiókot.

Mivel az elvárt értékek a szerver pillanatképét képviselik, a WN8 eltérül, ahogy a populáció és a járművek változnak. Egy tank, amelyet buffolnak, megemeli a lécet mindenkinek, aki azt a következő adathalmozati frissítéskor vezeti. A WN8 az adott fiók teljes történetében kumulatív, így néhány ezer korai csata továbbra is hatással van rá évekkel később, ezért a legtöbb játékos inkább a legújabb WN8-as értékét figyeli.
