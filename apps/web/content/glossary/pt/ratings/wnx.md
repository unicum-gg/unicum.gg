---
term: WNX
aliases:
  - WNX rating
  - avaliação WNX
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

Uma avaliação moderna por veículo que conta o dano de assistência junto com o dano causado e elimina completamente o termo de taxa de vitórias.

WNX mantém a estrutura do WN8, as proporções em relação aos valores esperados por veículo e altera o que conta. A assistência de rastreamento e rádio são adicionadas ao dano a dois terços de seu valor, portanto, fazer reconhecimento para um aliado e bloquear um rastreamento são pontuados como a contribuição que são, em vez de serem ignorados.

Não possui um componente de taxa de vitórias. Termos baseados em resultados recompensam o jogo em pelotão e contas longas mais do que medem o jogador, então WNX pontua apenas o que o jogador fez na batalha: dano mais assistência, eliminações e reconhecimento em relação ao que o veículo é esperado a produzir.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

O expoente final estica o topo da escala, portanto a diferença entre uma boa e uma conta excepcional permanece visível em vez de ser comprimida. ```

Os valores esperados vêm do tomato.gg, que os reinterpreta a partir de uma grande amostra de contas rastreadas. Esta é a avaliação padrão no unicum.gg porque reage mais rapidamente a como um veículo é realmente jogado hoje.
