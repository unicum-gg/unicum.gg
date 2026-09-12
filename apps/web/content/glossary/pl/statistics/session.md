---
term: Sesja
aliases:
  - statystyki sesji
  - statystyki dzienne
related:
  - recent-stats
  - battles
  - coverage
---

Blok bitew rozegranych podczas jednej serii gry, odtworzony przez tracker na podstawie różnicy między dwoma zrzutami stanu konta.

API Wargaming udostępnia łączne statystyki konta, a nie dane poszczególnych bitew. Tracker regularnie zapisuje zrzuty tych statystyk, a różnica między dwoma zrzutami odpowiada dokładnie bitwom rozegranym w międzyczasie wraz z zadanymi uszkodzeniami, zniszczeniami i wynikami.

Ta różnica jest sesją. Dzięki niej strona może pokazać, co gracz zrobił dzisiaj, zamiast tego, czego dokonał od 2013 roku, i to na jej podstawie obliczane są ostatnie oceny.

Jej dokładność zależy od częstotliwości wykonywania zrzutów stanu konta, dlatego sesja jest blokiem rozgrywki, a nie precyzyjnie określonym czasem rozpoczęcia i zakończenia, a bitwa rozegrana tuż przed wykonaniem zrzutu zostaje przypisana do sesji tego zrzutu.
