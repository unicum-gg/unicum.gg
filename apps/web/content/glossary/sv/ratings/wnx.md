---
term: WNX
aliases:
  - WNX-betyg
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

Ett modernt per-fordon betyg som räknar assistansskada tillsammans med skadan som åstadkommits och helt släpper win rate-termen.

WNX behåller formen av WN8, förhållanden mot förväntade värden per fordon, och ändrar vad det räknar. Spårning och radioassistans läggs till skadan med två tredjedelar av deras värde, så upptäckte ett mål för en allierad och blockering av ett spår poängsätts som den bidrag de är snarare än att ignoreras.

Det har ingen win rate-komponent. Utfall-baserade termer belönar platonande och långvariga konton mer än de mäter spelaren, så WNX poängsätter endast vad spelaren gjorde i striden: skada plus assistans, elimineringar och upptäckter mot vad fordonet förväntas producera.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Not: Exponenten i slutet sträcker toppen av skalan, så avståndet mellan ett bra och ett exceptionellt konto förblir synligt istället för att komprimeras. ```

De förväntade värdena kommer från tomato.gg, som omberäknar dem från ett stort urval av spårade konton. Detta är standardbetyget på unicum.gg eftersom det reagerar snabbast på hur ett fordon faktiskt spelas idag.
