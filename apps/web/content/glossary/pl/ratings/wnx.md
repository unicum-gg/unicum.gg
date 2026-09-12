---
term: WNX
aliases:
  - ocena WNX
  - ranking WNX
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

Nowoczesna ocena dla poszczególnych pojazdów, która uwzględnia uszkodzenia z asysty obok zadanych uszkodzeń i całkowicie pomija współczynnik zwycięstw.

WNX zachowuje strukturę WN8 i proporcje względem oczekiwanych wartości dla poszczególnych pojazdów, ale zmienia uwzględniane elementy. Uszkodzenia z asysty przy unieruchomieniu i przez radio są dodawane do zadanych uszkodzeń w wysokości dwóch trzecich ich wartości, dzięki czemu wykrycie przeciwnika dla sojusznika i zerwanie gąsienicy są oceniane jako rzeczywisty wkład, zamiast być pomijane.

Ocena nie zawiera współczynnika zwycięstw. Elementy oparte na wyniku bardziej nagradzają grę w plutonie i długo istniejące konta, niż mierzą umiejętności gracza, dlatego WNX ocenia wyłącznie to, co gracz zrobił w bitwie: zadane uszkodzenia wraz z uszkodzeniami z asysty, zniszczenia i wykrycia w porównaniu z oczekiwanymi osiągami pojazdu.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Wykładnik końcowy rozciąga górną część skali, dzięki czemu różnica między dobrym a wybitnym kontem pozostaje widoczna, zamiast ulegać spłaszczeniu. ```

Oczekiwane wartości pochodzą z tomato.gg, które przelicza je na podstawie dużej próby śledzonych kont. Jest to domyślna ocena na unicum.gg, ponieważ najszybciej reaguje na to, jak danym pojazdem faktycznie gra się obecnie.
