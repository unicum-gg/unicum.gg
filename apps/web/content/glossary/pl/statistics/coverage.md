---
term: Pokrycie
aliases:
  - śledzone konta
  - zakres śledzenia
related:
  - session
  - expected-values
links:
  - target: coverage
---

Jaką część bazy graczy na serwerze faktycznie śledzi serwis statystyczny i jak aktualne są dane tych kont.

Żaden serwis śledzący nie obejmuje wszystkich kont. API Wargaming ma ograniczoną liczbę zapytań, więc serwis wyszukuje konta za pośrednictwem list członków klanów i wyszukiwań, a następnie odświeża każde z nich tak często, jak może sobie na to pozwolić. Pokrycie określa odsetek aktywnych graczy w regionie, których dane posiada serwis, oraz to, jak niedawno każde konto zostało zaktualizowane.

Ma to znaczenie, ponieważ każda tabela wyników i każda średnia dla serwera są obliczane na podstawie śledzonej populacji, a nie całego serwera. Szerokie pokrycie sprawia, że liczby te są reprezentatywne, natomiast niewielkie pokrycie oznacza, że stanowią jedynie próbę.
