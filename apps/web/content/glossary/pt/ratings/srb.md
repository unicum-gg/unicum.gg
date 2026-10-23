---
term: Classificação de Fortaleza baseada em batalhas
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - mr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

A Classificação de Fortaleza em que o volume de batalhas é recompensado, em vez de servir apenas como requisito, fazendo com que um clã que se provou ao longo de centenas de batalhas fique acima de outro com a mesma SR obtida em vinte.

A SR ignora deliberadamente quanto um clã joga. A SRB usa essa mesma classificação e a multiplica por um termo que cresce com o número de batalhas acumuladas, portanto nunca pode ser inferior à SR na qual se baseia.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logarítmica, portanto as primeiras cem batalhas valem muito mais do que a milésima. ```

Uma única constante de volume para todos os níveis, de propósito: a Escaramuça de Nível X é jogada continuamente, enquanto os Avanços ocorrem em períodos concentrados durante algumas semanas por ano, portanto os níveis que realmente são mais jogados recebem um bônus maior. O bônus de volume é o que diferencia um clã que manteve uma classificação ao longo de centenas de batalhas de outro que a alcançou em vinte.
