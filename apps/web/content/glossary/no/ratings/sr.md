---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

Stronghold ytelsesvurdering brukt på unicum.gg: roster styrke multiplisert med hvor mye over gjennomsnittet en klan vinner, med boostede lister diskontert.

Stronghold-resultater er vanskelige å sammenligne fordi en klan velger sin motstand og sitt volum. SR svarer på et smalere spørsmål: hvor god er denne listen, og vinner den med den.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength er median Personal Rating av klanen over 4,500. Median, ikke gjennomsnitt: det avviser både den lave halen av små kontoer og et par bærere. ```

Roster strength måles over et konkurransegrunnlag snarere enn fra null, så gapet mellom en gjennomsnittlig liste og en elite liste er det dominerende begrepet. Win-faktoren er nøytral på 50% og superlinear, så å dominere er mer verdt enn å justere det.

Det siste begrepet er det anti-farming begrepet. Strongholds, spesielt Advances, spilles med boost-kontoer: små kontoer med nesten ingen tilfeldige kamper som kun eksisterer for å fylle en stronghold roster. Den fraværet kan ikke fakes, så en roster full av dem blir nedskalert.

Volum er ikke med, noe som gjør det til en ren ferdighetsvurdering. Et kampgulv holder en heldig håndfull spill unna lederlisten, og SRB er søskenet som belønner volum.
