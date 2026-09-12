---
term: Sessão
aliases:
  - session stats
  - estatísticas diárias
related:
  - recent-stats
  - battles
  - coverage
---

Um bloco de batalhas jogadas em uma única sessão, reconstruído por um rastreador a partir da diferença entre duas capturas de uma conta.

A API da Wargaming fornece os totais de uma conta, e não suas batalhas individuais. Um rastreador captura esses totais regularmente, e a diferença entre duas capturas é exatamente as batalhas jogadas entre elas, com seus danos, mortes e resultados.

Essa diferença é uma sessão. É assim que um site pode mostrar o que um jogador fez hoje em vez do que eles fizeram desde 2013, e é sobre isso que as classificações recentes são calculadas.

Sua resolução depende da frequência com que a conta é capturada, então uma sessão é um bloco de jogo em vez de um horário de início e fim precisos, e uma batalha jogada logo antes de uma captura está incluída na sessão dessa captura.
