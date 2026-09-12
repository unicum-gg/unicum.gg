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

En community-prestandabetyg som värderar en spelare mot den skada, dödar, upptäckter och basförsvar som förväntas av de fordon de faktiskt spelar, med en vinstfrekvens term ovanpå.

WN8 besvarar en fråga som ett rått genomsnitt inte kan. Är 1,800 skada per strid bra? På en Tier X tung är det obetydligt, på en Tier V medium är det exceptionellt. WN8 jämför varje fordon på ett konto mot servergenomsnittet för just det fordonet, så en spelare som mest kör Tier VI mäts mot Tier VI snarare än mot hela populationen.

Det publicerades 2013 av WN-teamet som efterträdare till WN7, vars nivåstraff gjorde det lätt att manipulera. Fem förhållanden matar det: skada, frags, upptäckter, tappade fångstpunkter och vinstfrekvens, var och en dividerad med det förväntade värdet för de spelade fordonen, golvad till noll och begränsad mot skadetermen så att en enda stark axel inte kan bära resten.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Varje förhållande här är den korrigerade formen: det råa förhållandet förskjutet av sin golv, fastlåst till det skadeförhållande det multiplicerar. ```

Skada utgör ungefär tre fjärdedelar av vikten, vilket är den vanliga klagan på det: en passiv spelare som odlar skada från bakgrunden presterar bättre än vad siffrorna förtjänar. Vinstfrekvens term är begränsad till 1.8 så att en stark platon inte kan blåsa upp ett svagt konto oändligt.

Eftersom de förväntade värdena är en ögonblicksbild av servern, driver WN8 när populationen och fordonen förändras. En tank som får buff höjer ribban för alla som kör den vid nästa datamängd uppdatering. WN8 är också kumulativ över hela ett kontos historia, så några tusen tidiga strider fortsätter att väga på det år senare, vilket är varför de flesta spelare tittar på sin senaste WN8 istället.
