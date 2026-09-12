---
term: Session
aliases:
  - session stats
  - statistiche giornaliere
related:
  - recent-stats
  - battles
  - coverage
---

Un blocco di battaglie giocate in un'unica seduta, ricostruito da un tracker dalla differenza tra due istantanee di un account.

L'API di Wargaming fornisce i totali di un account, non le sue battaglie individuali. Un tracker cattura quelle statistiche regolarmente e la differenza tra due istantanee corrisponde esattamente alle battaglie giocate nel mezzo, con i loro danni, uccisioni e risultati.

Quella differenza è una sessione. È il modo in cui un sito può mostrare cosa ha fatto un giocatore oggi anziché cosa ha fatto dal 2013 e su cui vengono calcolate le valutazioni recenti.

La sua risoluzione dipende da quanto spesso viene catturato l'account, quindi una sessione è un blocco di gioco piuttosto che un orario d'inizio e fine preciso, e una battaglia giocata subito prima di un'istantanea ricade nella sessione di quell'istantanea.
