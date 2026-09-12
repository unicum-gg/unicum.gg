---
term: Pokritnost
aliases:
  - tracked accounts
  - praćenje pokritnosti
related:
  - session
  - expected-values
links:
  - target: coverage
---

Koliko igrača na serveru neki sajt za statistiku zapravo prati i koliko su sveži ti nalozi.

Niti jedan tragač ne vidi svaki nalog. Wargaming-ov API ima ograničenje brzine, tako da sajt otkriva naloge putem klan listi i pretraga, a zatim ih osvežava svakih koliko može da priušti. Pokritnost je udeo aktivnih igrača u regionu koji sajt pokriva, i koliko su skoro svi osveženi.

To je važno zato što se svaka tabela i svaki prosek servera izračunavaju na osnovu praćenih naloga, a ne na osnovu celog servera. Široka pokritnost čini te brojeve reprezentativnim, dok tanka pokritnost čini njih uzorkom.
