---
term: Classificação do modo
aliases:
  - MR
  - classificação do modo
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

A classificação de desempenho que o unicum.gg usa para os modos de batalha fora das Batalhas aleatórias, calculada a partir da experiência média por batalha e da taxa de vitórias, cada uma comparada com a mediana dos jogadores desse modo.

WN7, WN8 e WNX não podem ser usados nesses modos. Todos os três são calculados com base num valor de dano esperado medido nas Batalhas aleatórias, pelo que uma Escaramuça de Fortaleza é avaliada como uma batalha aleatória que ninguém poderia ter jogado: o modo é mais curto e tem limitações de nível, o que reduz o dano de um bom jogador a uma fração da sua média nas Batalhas aleatórias, enquanto a sua taxa de vitórias fica perto de 90%. Medido num veículo, o mesmo jogador obteve 1,794 WNX em Escaramuça contra 4,708 nas Batalhas aleatórias, com 89.5% de vitórias contra 71.9%. A resposta honesta não é um WN8 corrigido, mas uma pergunta diferente, que o MR faz: como se compara este jogador com as pessoas que jogam este modo.

Usa dois eixos. A experiência média por batalha é o indicador de eficácia, porque a própria fórmula de experiência do jogo já inclui dano, veículos destruídos, deteção e tempo de sobrevivência, pelo que eixos separados contabilizariam a mesma batalha duas vezes. A taxa de vitórias representa o resultado. Cada valor é dividido pela mediana do próprio modo, ambos recebem o mesmo peso e, depois, um termo de volume reduz o peso de uma amostra pequena, para que uma centena de batalhas não possa liderar uma classificação à frente de alguém com milhares.

Uma última divisão é o que torna o número comparável: a pontuação é ajustada pela pontuação mediana do próprio modo, pelo que **1000 corresponde ao jogador mediano em todos os modos**. Sem isso, os modos não seriam comparáveis mesmo depois de normalizar os dois eixos, porque o termo de volume considera o número de batalhas e os modos são jogados em volumes muito diferentes: nas medições da região EU, a pontuação mediana variou entre 893 nas Guerras de Clãs VI e 1300 em Escaramuça, o que mostraria a verde um jogador mediano de Escaramuça e a laranja um jogador mediano noutro modo, apesar de ocuparem a mesma posição relativa.

O MR não alega permitir uma comparação com o WN8. Essas métricas avaliam um jogador em relação a toda a base de jogadores, enquanto o MR o avalia em relação a um grupo autosselecionado, e um modo que atrai jogadores fortes tem uma fasquia mais alta do que outro que não os atrai. Indica a sua posição entre as pessoas que realmente encontra nesse modo.
