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

Een community prestatiebeoordeling die een speler beoordeelt op basis van de schade, kills, spotting en basisverdediging die wordt verwacht van de voertuigen die ze daadwerkelijk spelen, met een winpercentage term bovenop.

WN8 beantwoordt een vraag die een ruwe gemiddelde niet kan beantwoorden. Is 1.800 schade per strijd goed? Op een Tier X zware tank is het onopvallend, op een Tier V medium is het uitzonderlijk. WN8 vergelijkt elk voertuig op een account met het servergemiddelde voor datzelfde voertuig, zodat een speler die voornamelijk Tier VI bestuurd wordt gemeten tegen Tier VI in plaats van tegen de hele populatie.

Het werd in 2013 gepubliceerd door het WN-team als de opvolger van WN7, wiens tier straf het gemakkelijk maakte om ermee te gamen. Vijf verhoudingen dragen eraan bij: schade, frags, spotting, verloren veroveringspunten en winpercentage, elk gedeeld door de verwachte waarde voor de gespeelde voertuigen, afgerond naar nul en begrensd tegen de schade term zodat een enkele sterke as de rest niet kan dragen.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Elke verhouding hier is de gecorrigeerde vorm: de ruwe verhouding verschoven door zijn vloer, vastgezet aan de schadeverhouding die het vermenigvuldigt. ```

Schade draagt ongeveer driekwart van het gewicht, wat de gebruikelijke klacht erover is: een passieve speler die schade van achteren verzamelt scoort beter dan de cijfers rechtvaardigen. De winpercentage term is begrensd op 1.8 zodat een sterk platoon een zwak account niet oneindig kan opblazen.

Omdat de verwachte waarden een momentopname van de server zijn, drift WN8 naarmate de populatie en de voertuigen veranderen. Een tank die wordt verbeterd verhoogt de lat voor iedereen die het bestuurt bij de volgende dataset update. WN8 is ook cumulatief over de hele geschiedenis van een account, zodat een paar duizend vroege gevechten meerdere jaren later blijven doorwegen, wat de reden is dat de meeste spelers hun recente WN8 liever in de gaten houden.
