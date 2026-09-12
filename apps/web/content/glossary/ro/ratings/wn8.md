---
term: WN8
aliases:
  - WN8 rating
  - wn8 score
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

Un rating de performanță comunitară care evaluează un jucător în funcție de daunele, uciderile, descoperirile și apărarea de bază a vehiculelor pe care le joacă efectiv, cu un termeni de rata victoriilor deasupra.

WN8 răspunde la o întrebare pe care o medie brută nu o poate. Este 1.800 de daune pe bătălie bun? Pe un greu de Tier X nu este remarcabil, pe un mediu de Tier V este excepțional. WN8 compară fiecare vehicul pe un cont cu media serverului pentru același vehicul, astfel încât un jucător care conduce în principal Tier VI este măsurat în funcție de Tier VI și nu în raport cu întreaga populație.

A fost publicat în 2013 de echipa WN ca succesor al WN7, a cărui penalizare pe tier a făcut-o ușor de manipulat. Cinci rapoarte îi contribuie: daune, fragmente, descoperiri, puncte de captură abandonate și rata victoriilor, fiecare împărțit la valoarea așteptată pentru vehiculele jucate, plafonat la zero și limitat față de termenul de daune, astfel încât un singur ax puternic să nu poată susține restul.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Fiecare raport aici este forma corectată: raportul brut mutat de la plafonul său, limitat la raportul de daune pe care îl înmulțește. ```

Daunele reprezintă aproximativ trei sferturi din greutate, ceea ce este plângerea obișnuită legată de acesta: un jucător pasiv care farmecă daune din spate obține un scor mai bun decât merită cifrele. Termenul de rata victoriilor este limitat la 1.8 astfel încât un pluton puternic să nu poată umfla un cont slab la nesfârșit.

Datorită valorilor așteptate care sunt o instantanee a serverului, WN8 se modifică pe măsură ce populația și vehiculele se schimbă. Un tank care beneficiază de upgrade ridică bara pentru toți cei care îl conduc la următoarea actualizare a setului de date. WN8 este de asemenea cumulativ pe tot parcursul istoriei unui cont, astfel încât câteva mii de bătălii din primele etape continuă să influențeze scorul mulți ani mai târziu, motiv pentru care cei mai mulți jucători urmăresc WN8-ul lor recent în loc.
