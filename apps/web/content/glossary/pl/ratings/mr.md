---
term: Ocena trybu
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

Ocena skuteczności używana przez unicum.gg dla trybów bitew innych niż Bitwy losowe, oparta na średnim doświadczeniu na bitwę i współczynniku zwycięstw, przy czym każda z tych wartości jest odnoszona do mediany wśród graczy danego trybu.

Nie można tam używać WN7, WN8 ani WNX. Wszystkie trzy opierają się na oczekiwanej wartości uszkodzeń zmierzonej w Bitwach losowych, dlatego Potyczka w Twierdzy jest oceniana jak Bitwa losowa, której nikt nie mógłby rozegrać: ten tryb jest krótszy i ograniczony poziomami, przez co uszkodzenia dobrego gracza stanowią ułamek jego średniej z Bitew losowych, podczas gdy jego współczynnik zwycięstw utrzymuje się w pobliżu 90%. W pomiarze dla jednego pojazdu ten sam gracz uzyskał 1,794 WNX w Potyczce wobec 4,708 w Bitwach losowych, przy 89.5% zwycięstw wobec 71.9%. Uczciwą odpowiedzią nie jest poprawione WN8, lecz inne pytanie, które zadaje MR: jak ten gracz wypada na tle osób grających w tym trybie.

Wykorzystuje dwie osie. Średnie doświadczenie na bitwę jest wskaźnikiem skuteczności, ponieważ formuła doświadczenia w grze uwzględnia już uszkodzenia, zniszczone pojazdy, wykrywanie i czas przetrwania, więc osobne osie liczyłyby tę samą bitwę dwukrotnie. Współczynnik zwycięstw jest wynikiem końcowym. Każda wartość jest dzielona przez medianę właściwą dla danego trybu, obie mają taką samą wagę, a następnie składnik liczby bitew obniża ocenę małej próbki, aby sto bitew nie pozwalało znaleźć się w rankingu przed kimś, kto ma ich tysiące.

Ostatnie dzielenie sprawia, że wynik można stosować we wszystkich trybach: jest on skalowany względem mediany wyników właściwej dla danego trybu, więc **1000 oznacza gracza z mediany w każdym trybie**. Bez tego tryby nie byłyby porównywalne nawet po normalizacji obu osi, ponieważ składnik liczby bitew uwzględnia ich liczbę, a poszczególne tryby są rozgrywane z radykalnie różną częstotliwością: w pomiarze na EU mediana wyników wynosiła od 893 w Wojnach klanów VI do 1300 w Potyczce, co oznaczałoby oznaczenie przeciętnego gracza Potyczki kolorem zielonym, a przeciętnego gracza w innym trybie kolorem pomarańczowym, mimo takiej samej pozycji względem innych.

MR nie służy natomiast do porównywania z WN8. Tamte oceny porównują gracza z całą bazą graczy, natomiast MR porównuje go z samodzielnie wybraną grupą, a w trybie przyciągającym silnych graczy poprzeczka jest wyżej niż w takim, który ich nie przyciąga. Pokazuje, gdzie plasujesz się wśród graczy, których faktycznie tam spotykasz.
