---
term: Lägesbetyg
aliases:
  - MR
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

Lägesbetyg är det prestandabetyg som unicum.gg använder för stridslägen utanför Slumptävlingar, baserat på genomsnittlig erfarenhet per strid och segerfrekvens, där båda jämförs med medianen för dem som spelar läget.

WN7, WN8 och WNX kan inte användas där. Alla tre bygger på ett förväntat skadevärde som uppmätts i Slumptävlingar, så en Skärmytsling i Befästning poängsätts som en Slumptävling som ingen hade kunnat spela: läget är kortare och begränsat till vissa nivåer, vilket gör att en bra spelares skada blir en bråkdel av spelarens genomsnitt i Slumptävlingar samtidigt som segerfrekvensen ligger nära 90%. Mätt på ett och samma fordon fick samma spelare 1,794 WNX i Skärmytsling jämfört med 4,708 i Slumptävlingar, med 89.5% segrar jämfört med 71.9%. Det ärliga svaret är inte ett korrigerat WN8 utan en annan fråga, och MR ställer den: hur står sig den här spelaren jämfört med dem som spelar det här läget.

MR använder två axlar. Genomsnittlig erfarenhet per strid är måttet på effektivitet, eftersom spelets egen erfarenhetsformel redan tar hänsyn till skada, utslagningar, upptäckt och överlevnadstid, så separata axlar skulle räkna samma strid två gånger. Segerfrekvensen är utfallet. Varje värde delas med lägets egen median, de viktas lika och därefter minskar en volymterm betydelsen av ett litet urval så att hundra strider inte kan ge en topplacering före någon med tusentals.

En sista division är det som gör värdet jämförbart: poängen skalas efter lägets egen medianpoäng, så **1000 är medianen för spelare i varje läge**. Utan den skulle lägena inte vara jämförbara ens efter att de två axlarna normaliserats, eftersom volymtermen utgår från antalet strider och lägena spelas i oerhört olika omfattning: mätt på EU varierade medianpoängen från 893 i Klankrig VI till 1300 i Skärmytsling, vilket skulle visa en genomsnittlig spelare i Skärmytsling som grön och en genomsnittlig spelare i andra lägen som orange trots samma placering.

Vad MR inte gör anspråk på är en jämförelse med WN8. Sådana mått bedömer en spelare mot hela spelarbasen, medan MR bedömer spelaren mot en självvald grupp, och ett läge som lockar starka spelare har en högre ribba än ett som inte gör det. Det visar var du står bland de spelare du faktiskt möter där.
