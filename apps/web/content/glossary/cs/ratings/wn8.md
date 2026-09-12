---
term: WN8
aliases:
  - hodnocení WN8
  - skóre WN8
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

Komunitní hodnocení výkonu, které posuzuje hráče podle poškození, zničených vozidel, odhalení a obrany základny očekávaných u vozidel, která skutečně hraje, a navíc zohledňuje míru vítězství.

WN8 odpovídá na otázku, kterou prostý průměr zodpovědět nedokáže. Je 1,800 poškození za bitvu dobrý výsledek? U těžkého tanku X. úrovně není nijak výjimečný, u středního tanku V. úrovně je mimořádný. WN8 porovnává každé vozidlo na účtu se serverovým průměrem stejného vozidla, takže hráč, který většinou jezdí s vozidly VI. úrovně, je poměřován s VI. úrovní, nikoli s celou hráčskou populací.

Hodnocení bylo zveřejněno v roce 2013 týmem WN jako nástupce WN7, s nímž bylo kvůli penalizaci za úroveň snadné manipulovat. Vstupuje do něj pět poměrů: poškození, zničená vozidla, odhalení, snížené body obsazování a míra vítězství. Každý se dělí očekávanou hodnotou pro hraná vozidla, zdola se omezuje nulou a shora podle ukazatele poškození, aby jediná silná oblast nemohla vyvážit všechny ostatní.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Každý zde uvedený poměr je v upravené podobě: hrubý poměr je posunut o svou spodní hranici a omezen podle poměru poškození, kterým se násobí. ```

Poškození tvoří přibližně tři čtvrtiny váhy, což je nejčastější výtka vůči tomuto hodnocení: pasivní hráč, který způsobuje poškození zezadu, dosáhne lepšího skóre, než si podle ostatních čísel zaslouží. Ukazatel míry vítězství je omezen na 1.8, takže silná četa nemůže donekonečna nadhodnocovat slabý účet.

Protože očekávané hodnoty představují momentální stav serveru, WN8 se mění spolu s hráčskou populací a vozidly. Když je tank vylepšen, při příští aktualizaci datové sady se zvýší laťka pro všechny, kdo s ním hrají. WN8 se také počítá souhrnně za celou historii účtu, takže několik tisíc prvních bitev ho ovlivňuje i po letech. Proto většina hráčů raději sleduje své nedávné WN8.
