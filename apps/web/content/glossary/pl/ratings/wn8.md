---
term: WN8
aliases:
  - ranking WN8
  - wynik WN8
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

Społecznościowy wskaźnik skuteczności, który ocenia gracza na podstawie uszkodzeń, zniszczeń, wykryć i obrony bazy oczekiwanych dla pojazdów, którymi faktycznie gra, z dodatkowym uwzględnieniem współczynnika zwycięstw.

WN8 odpowiada na pytanie, na które nie odpowie zwykła średnia. Czy 1,800 uszkodzeń na bitwę to dobry wynik? Dla pojazdu ciężkiego X poziomu nie jest to nic niezwykłego, ale dla pojazdu średniego V poziomu jest to wynik wyjątkowy. WN8 porównuje każdy pojazd na koncie ze średnią serwera dla tego samego pojazdu, dzięki czemu gracz jeżdżący głównie pojazdami VI poziomu jest porównywany z innymi graczami na VI poziomie, a nie z całą populacją.

WN8 został opublikowany w 2013 roku przez zespół WN jako następca WN7, którego kara za poziom pojazdu ułatwiała manipulowanie wynikiem. Uwzględnia pięć współczynników: uszkodzenia, zniszczenia, wykrycia, punkty obrony bazy i współczynnik zwycięstw. Każdy z nich jest dzielony przez wartość oczekiwaną dla używanych pojazdów, ograniczany od dołu do zera i od góry względem współczynnika uszkodzeń, aby jeden bardzo dobry parametr nie mógł zrekompensować pozostałych.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Każdy współczynnik ma tutaj postać skorygowaną: surowy współczynnik jest przesunięty o swoją wartość progową i ograniczony do współczynnika uszkodzeń, przez który jest mnożony. ```

Uszkodzenia odpowiadają za około trzy czwarte wagi wyniku, co jest najczęstszym zarzutem wobec WN8: pasywny gracz, który nabija uszkodzenia z tyłu, osiąga wynik lepszy, niż na to zasługuje. Współczynnik zwycięstw jest ograniczony do 1.8, dzięki czemu silny pluton nie może bez końca zawyżać wyniku słabego konta.

Ponieważ wartości oczekiwane są migawką danych z serwera, WN8 zmienia się wraz z populacją graczy i pojazdami. Gdy pojazd zostaje wzmocniony, przy następnej aktualizacji zestawu danych rośnie próg dla wszystkich, którzy nim grają. WN8 jest również wynikiem skumulowanym z całej historii konta, więc kilka tysięcy wczesnych bitew wpływa na niego nawet po wielu latach. Dlatego większość graczy obserwuje zamiast tego swój ostatni WN8.
