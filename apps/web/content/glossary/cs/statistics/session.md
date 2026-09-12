---
term: Herní relace
aliases:
  - session stats
  - daily stats
  - statistiky relace
  - denní statistiky
related:
  - recent-stats
  - battles
  - coverage
---

Blok bitev odehraných během jednoho hraní, který tracker rekonstruuje z rozdílu mezi dvěma snímky účtu.

API společnosti Wargaming poskytuje celkové statistiky účtu, nikoli údaje o jednotlivých bitvách. Tracker tyto souhrnné údaje pravidelně zaznamenává a rozdíl mezi dvěma snímky přesně odpovídá bitvám odehraným mezi nimi, včetně jejich poškození, zničených vozidel a výsledků.

Tento rozdíl představuje herní relaci. Díky němu může web zobrazit, co hráč udělal dnes, namísto toho, co udělal od roku 2013, a počítají se z něj aktuální hodnocení.

Její časové rozlišení závisí na tom, jak často se pořizují snímky účtu, takže herní relace představuje blok hraní, nikoli přesný čas začátku a konce, a bitva odehraná těsně před pořízením snímku připadne do relace daného snímku.
