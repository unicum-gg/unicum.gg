---
term: WN8
aliases:
  - WN8 rating
  - pontuação wn8
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

Uma classificação de desempenho da comunidade que avaliou um jogador em relação ao dano, mortes, reconhecimento e defesa base esperados dos veículos que eles realmente jogam, com um termo de taxa de vitória por cima.

WN8 responde a uma pergunta que uma média bruta não pode. É bom 1.800 de dano por batalha? Em um pesado de Tier X é pouco notável, em um médio de Tier V é excepcional. WN8 compara cada veículo em uma conta contra a média do servidor para esse mesmo veículo, então um jogador que dirige principalmente Tier VI é medido contra Tier VI em vez de toda a população.

Foi publicado em 2013 pela equipe WN como o sucessor do WN7, cuja penalidade de tier facilitava a manipulação. Cinco razões o alimentam: dano, frags, reconhecimento, pontos de captura perdidos e taxa de vitória, cada um dividido pelo valor esperado para os veículos jogados, reduzido a zero e limitado em relação ao termo de dano para que um único eixo forte não possa carregar o resto.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Cada razão aqui é a forma corrigida: a razão bruta deslocada pelo seu piso, limitada à razão de dano que multiplica. ```

O dano carrega aproximadamente três quartos do peso, que é a reclamação habitual sobre isso: um jogador passivo que ganha dano na retaguarda pontua melhor do que os números merecem. O termo da taxa de vitória é limitado a 1.8, então um forte pelotão não pode inflar uma conta fraca indefinidamente.

Como os valores esperados são uma instantânea do servidor, o WN8 oscila à medida que a população e os veículos mudam. Um tanque que é melhorado eleva a referência para todos que o dirigem na próxima atualização do conjunto de dados. O WN8 também é cumulativo ao longo de toda a história de uma conta, então alguns milhares de batalhas iniciais continuam a pesar sobre ele anos depois, que é por isso que a maioria dos jogadores observa seu WN8 recente em vez disso.
