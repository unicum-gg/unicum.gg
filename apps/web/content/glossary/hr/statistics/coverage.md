---
term: Pokriće
aliases:
  - tracked accounts
  - praćenje pokrića
related:
  - session
  - expected-values
links:
  - target: coverage
---

Koliko igrača na serveru zapravo prati stranica sa statistikama i koliko su ti računi svježi.

Niti jedan tracker ne prati svaki račun. Wargamingov API ima ograničenja brzine, pa stranica otkriva račune putem popisa klanova i pretraživanja, a zatim ih osvježava u ritmu koji si može priuštiti. Pokriće je udio aktivnih igrača u regiji koji je stranica zadržala i koliko je svaki od njih nedavno ažuriran.

To je važno jer se svaka ljestvica i svaki prosjek servera računa na temelju praćene populacije, a ne na temelju cijelog servera. Široko pokriće čini te brojke reprezentativnim, a usko pokriće ih čini samo uzorkom.
