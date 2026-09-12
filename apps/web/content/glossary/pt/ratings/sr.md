---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

O Stronghold performance rating usado no unicum.gg: força do elenco multiplicada por quão acima da média um clã vence, com elencos impulsionados descontados.

Os resultados de Stronghold são difíceis de comparar porque um clã escolhe sua oposição e seu volume. O SR responde a uma pergunta mais específica: quão bom é este elenco e ele vence com isso.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Força do elenco é a classificação pessoal mediana do clã acima de 4.500. A mediana, não a média: ela ignora tanto a cauda baixa de contas pequenas quanto alguns carregadores. ```

A força do elenco é medida acima de um piso competitivo em vez de partir do zero, então a diferença entre um elenco médio e um elite é o termo dominante. O fator de vitória é neutro em 50% e super-linear, então dominar vale mais do que vencer por uma margem pequena.

O último termo é o anti-farming. Strongholds, especialmente Avanços, são jogados com contas de impulso: contas pequenas com quase nenhuma batalha aleatória que existem apenas para preencher um elenco de stronghold. Essa ausência não pode ser falsificada, então um elenco cheio delas é escalonado para baixo.

Volume não está incluído, o que o torna uma classificação puramente de habilidade. Um piso de batalha mantém um punhado sortudo de jogos fora da tabela de líderes, e o SRB é o irmão que recompensa o volume.
