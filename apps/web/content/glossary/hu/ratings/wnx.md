---
term: WNX
aliases:
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

A modern jármű-alapú értékelés, amely számításba veszi a segítő sebzést a járművet terhelő sebzés mellett, és teljesen elhagyja a győzelmi arány kifejezést.

A WNX megtartja a WN8 szerkezetét, az arányokat a járművet terhelő várható értékekhez, és megváltoztatja, hogy mit számít. A nyomozás és a rádiós segítség a sebzéshez két harmad értékükön hozzáadódik, tehát az, hogy egy szövetségesnek segítesz a nyomozásban vagy egy lánctalpat blokkolsz, hozzájárulásként van értékelve, nem pedig figyelmen kívül hagyva.

Nincs győzelmi arány komponense. Az eredményalapú kifejezések a platoonokká való jutalmazás miatt és a hosszú távú fiókokra nagyobb hangsúlyt fektetnek, mint a játékos értékelésére, így a WNX csak azt az eredményt méri, amit a játékos a csatában végzett: sebzés plusz segítség, fragok és nyomozások a jármű által várhatóan produkált vs. értékhez képest.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

A kifejezés szorzója meghosszabbítja a skála tetejét, így a különbség egy jó és egy kivételes teljesítmény között látható marad a tömörítés helyett. ```

A várható értékek a tomato.gg-től származnak, amelyeket egy nagy mintán nyilvántartott fiókok alapján számítanak újra. Ez a default értékelés az unicum.gg-n, mert a leggyorsabban reagál arra, ahogy egy járműt valójában ma játszanak.
