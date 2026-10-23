---
term: Valutazione della modalità
aliases:
  - MR
  - valutazione modalità
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

L'indice di rendimento che unicum.gg utilizza per le modalità di battaglia diverse dalle Battaglie casuali, basato sull'esperienza media per battaglia e sulla percentuale di vittorie, ciascuna confrontata con la mediana dei giocatori di quella modalità.

WN7, WN8 e WNX non possono essere utilizzati in queste modalità. Tutti e tre si basano su un valore di danno atteso misurato nelle Battaglie casuali, quindi una Schermaglia di Roccaforte viene valutata come una battaglia casuale che nessuno avrebbe potuto giocare: la modalità è più breve e limitata per livello, perciò il danno di un buon giocatore si riduce a una frazione della sua media nelle Battaglie casuali, mentre la sua percentuale di vittorie si avvicina al 90%. Prendendo in esame un solo veicolo, lo stesso giocatore ha ottenuto 1,794 WNX in Schermaglia contro 4,708 nelle Battaglie casuali, con l'89.5% di vittorie contro il 71.9%. La risposta corretta non è un WN8 rettificato, ma una domanda diversa, ed è quella posta da MR: come si confronta questo giocatore con gli altri giocatori di questa modalità.

Utilizza due assi. L'esperienza media per battaglia è l'indicatore di efficacia, perché la formula dell'esperienza del gioco include già danno, eliminazioni, avvistamento e tempo di sopravvivenza, quindi assi separati conterebbero due volte la stessa battaglia. La percentuale di vittorie rappresenta il risultato. Ciascun valore viene diviso per la mediana della modalità, i due valori hanno lo stesso peso e un fattore legato al volume riduce poi l'incidenza di un campione piccolo, così cento battaglie non possono portare in cima alla classifica davanti a un giocatore che ne ha migliaia.

Un'ultima divisione rende il numero applicabile a tutte le modalità: il punteggio viene rapportato al punteggio mediano della modalità, quindi **1000 rappresenta il giocatore mediano in ogni modalità**. Senza questa operazione, le modalità non sarebbero confrontabili neppure dopo aver normalizzato i due assi, perché il fattore legato al volume considera il numero di battaglie e le modalità vengono giocate in quantità estremamente diverse: nei dati rilevati su EU, il punteggio mediano variava da 893 in Clan Wars VI a 1300 in Schermaglia, il che mostrerebbe in verde un giocatore medio di Schermaglia e in arancione un giocatore medio di qualsiasi altra modalità, pur avendo la stessa posizione relativa.

MR non pretende invece di offrire un confronto con WN8. Questi indici valutano un giocatore rispetto all'intera base di giocatori, mentre MR lo valuta rispetto a un gruppo autoselezionato, e una modalità che attira giocatori forti ha una soglia più alta rispetto a una che non li attira. Indica la tua posizione tra i giocatori che incontri effettivamente in quella modalità.
