---
term: Pokrivnost
aliases:
  - tracked accounts
  - praćenje pokrivnosti
related:
  - session
  - expected-values
links:
  - target: coverage
---

Kakav dio igračke baze servera zapravo prati sajt za statistiku i koliko su svježi ti nalozi.

Nijedan traker ne može vidjeti svaki nalog. Wargamingov API ima ograničenja u brzini, tako da sajt otkriva naloge kroz roster klanova i pretrage, a zatim osvježava svaki nalog u ritmu koji može priuštiti. Pokrivnost je udio aktivnih igrača u regiji koji sajt drži i koliko je svaki nalog nedavno ažuriran.

To je važno jer se svaka tabela lidera i svaki prosjek servera računa na osnovu praćene populacije, a ne na osnovu cijelog servera. Široka pokrivnost čini te brojke reprezentativnim, dok tanka pokrivnost čini njih uzorkom.
