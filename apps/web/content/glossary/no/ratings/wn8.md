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

En fellesskaps ytelsesvurdering som poengsetter en spiller mot skaden, drapene, oppdagelsen og basesikringen som forventes av de kjøretøyene de faktisk spiller, med en seierprosent på toppen.

WN8 svarer på et spørsmål som et rått gjennomsnitt ikke kan. Er 1,800 skade per kamp bra? På et Tier X tungt kjøretøy er det ubetydelig, på et Tier V medium er det eksepsjonelt. WN8 sammenligner hvert kjøretøy på en konto mot servergjennomsnittet for det samme kjøretøyet, så en spiller som hovedsakelig kjører Tier VI blir målt mot Tier VI snarere enn mot hele befolkningen.

Det ble publisert i 2013 av WN-teamet som etterfølgeren til WN7, hvis nivåstraff gjorde det lett å manipulere. Fem forhold mater det: skade, drap, oppdagelse, tapte innfangingspoeng og seierprosent, hver delt på den forventede verdien for de spilte kjøretøyene, avrundet ned til null og begrenset mot skadeverdien, så en enkelt sterk akse ikke kan bære resten.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Hvert forhold her er den korrigerte formen: det rå forholdet flyttet av sin bunnverdi, begrenset til skadeforholdet det multipliserer. ```

Skade bærer omtrent tre fjerdedeler av vekten, som er den vanlige klagen om det: en passiv spiller som skaffer skade fra bakdelen får høyere poeng enn tallene skulle tilsi. Seierprosenten er begrenset til 1.8 så en sterk platon ikke kan blåse opp en svak konto uendelig.

Fordi de forventede verdiene er et øyeblikksbilde av serveren, driver WN8 seg ettersom befolkningen og kjøretøyene endres. Et kjøretøy som får buff hever lista for alle som kjører det ved neste datasettoppdatering. WN8 er også kumulativ over en kontos hele historie, så noen tusen tidlige kamper fortsetter å påvirke det mange år senere, noe som er grunnen til at de fleste spillere ser på sin nylige WN8 i stedet.
