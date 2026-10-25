---
term: WNX
aliases:
  - WNX rating
  - WNX értékelés
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

Modern, járművenkénti értékelés, amely a támogatási sebzést is beleszámítja az okozott sebzés mellett, és teljesen elhagyja a győzelmi arány összetevőjét.

A WNX megőrzi a WN8 felépítését és a járművenkénti elvárt értékekhez viszonyított arányokat, de megváltoztatja, hogy mit számít bele. A láncolási és rádiós támogatás az értékük kétharmadával hozzáadódik a sebzéshez, így a szövetséges felderítése és egy lánctalp blokkolása valódi hozzájárulásként jelenik meg az értékelésben, nem pedig figyelmen kívül hagyott teljesítményként.

Nincs benne győzelmi arány. Az eredményalapú mutatók jobban jutalmazzák a szakaszozást és a régebbi fiókokat, mint amennyire a játékost mérik, ezért a WNX csak azt értékeli, amit a játékos a csatában végzett: a sebzést és a támogatást, valamint a kilövéseket és a felderítéseket ahhoz képest, amit az adott járműtől elvárnak.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

A kitevő a skála felső részét széthúzza, így egy jó és egy kivételes fiók közötti különbség látható marad ahelyett, hogy összesűrűsödne. ```

Az elvárt értékeket követett fiókok nagy mintája alapján számítják újra. Ez az alapértelmezett értékelés az unicum.gg oldalon, mert ez reagál a leggyorsabban arra, hogyan játsszák ténylegesen az adott járművet napjainkban.
