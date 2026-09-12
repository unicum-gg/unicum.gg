---
term: WN8
aliases:
  - WN8 rating
  - classifica wn8
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

Una valutazione delle performance della community che classifica un giocatore rispetto al danno, uccisioni, avvistamenti e difesa base previsti per i veicoli che gioca effettivamente, con un termine sulla percentuale di vittorie.

WN8 risponde a una domanda che una media grezza non può. È buono un danno di 1.800 per battaglia? Su un carro pesante di Tier X è poco notevole, su un carro medio di Tier V è eccezionale. WN8 confronta ogni veicolo su un account rispetto alla media del server per quello stesso veicolo, così un giocatore che guida principalmente Tier VI viene misurato contro il Tier VI invece che contro l'intera popolazione.

È stato pubblicato nel 2013 dal team WN come successore di WN7, il cui penalità di tier lo rendeva facile da manipolare. Cinque rapporti lo alimentano: danno, uccisioni, avvistamenti, punti cattura persi e percentuale di vittorie, ciascuno diviso per il valore atteso per i veicoli giocati, limitato a zero e soggetto a un tetto rispetto al termine di danno, quindi un solo asse forte non può sostenere il resto.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Ogni rapporto qui è la forma corretta: il rapporto grezzo spostato dal suo limite, vincolato al rapporto di danno che moltiplica. ```

Il danno rappresenta circa tre quarti del peso, che è il solito reclamo al riguardo: un giocatore passivo che accumula danno da lontano ottiene un punteggio migliore di quanto i numeri meriterebbero. Il termine sulla percentuale di vittorie è limitato a 1.8 affinché un forte plotone non possa gonfiare indefinitamente un account debole.

Poiché i valori attesi sono un istantanea del server, WN8 si sposta mentre la popolazione e i veicoli cambiano. Un carro che viene potenziato alza il livello per tutti coloro che lo guidano al prossimo aggiornamento del dataset. WN8 è anche cumulativo sull'intera storia di un account, quindi alcune migliaia di battaglie iniziali continuano a influenzare il punteggio anni dopo, motivo per cui la maggior parte dei giocatori osserva il loro recente WN8 invece.
