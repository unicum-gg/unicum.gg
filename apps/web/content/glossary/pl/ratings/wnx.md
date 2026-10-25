---
term: WNX
aliases:
  - WNX rating
  - ocena WNX
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

Nowoczesna ocena dla każdego pojazdu, która uwzględnia obrażenia z asysty obok zadanych obrażeń i całkowicie pomija współczynnik zwycięstw.

WNX zachowuje strukturę WN8 i stosunek wyników do oczekiwanych wartości dla każdego pojazdu, ale zmienia zakres uwzględnianych statystyk. Pomoc w uszkadzaniu gąsienic i asysta radiowa są dodawane do obrażeń z wagą dwóch trzecich, dzięki czemu wykrywanie przeciwnika dla sojusznika i blokowanie gąsienic jest oceniane jako rzeczywisty wkład gracza, a nie pomijane.

Nie zawiera współczynnika zwycięstw. Wskaźniki oparte na wyniku nagradzają grę w plutonach i starsze konta bardziej, niż mierzą umiejętności gracza, dlatego WNX ocenia wyłącznie działania gracza w bitwie: obrażenia oraz asystę, zniszczone pojazdy i wykrycia w porównaniu z tym, czego oczekuje się od danego pojazdu.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Wykładnik końcowy rozciąga górną część skali, dzięki czemu różnica między dobrym a wyjątkowym kontem pozostaje widoczna zamiast się zacierać. ```

Oczekiwane wartości są ponownie obliczane na podstawie dużej próby śledzonych kont. Jest to domyślna ocena na unicum.gg, ponieważ najszybciej reaguje na sposób, w jaki dany pojazd jest faktycznie obecnie używany.
