---
term: WNX
aliases:
  - WNX rating
  - classificação WNX
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

Uma classificação moderna por veículo que contabiliza o dano assistido junto com o dano causado e elimina completamente o termo de taxa de vitórias.

O WNX mantém o formato do WN8 e as proporções em relação aos valores esperados por veículo, mas muda o que contabiliza. A assistência por imobilização e por detecção é adicionada ao dano com dois terços do seu valor, para que detectar um inimigo para um aliado e bloquear uma esteira sejam pontuados como a contribuição que realmente representam, em vez de serem ignorados.

Ele não tem um componente de taxa de vitórias. Os termos baseados no resultado favorecem jogar em pelotão e contas antigas mais do que medem o jogador, por isso o WNX pontua apenas o que o jogador fez na batalha: dano mais assistência, abates e detecções em comparação com o que se espera que o veículo produza.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

O expoente final amplia o topo da escala, para que a diferença entre uma conta boa e uma excepcional continue visível, em vez de ser comprimida. ```

Os valores esperados são recalculados a partir de uma grande amostra de contas monitoradas. Esta é a classificação padrão no unicum.gg porque reage mais rapidamente à forma como um veículo é realmente jogado atualmente.
