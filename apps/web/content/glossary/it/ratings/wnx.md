---
term: WNX
aliases:
  - WNX rating
  - valutazione WNX
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

Una moderna valutazione per veicolo che conteggia il danno da assistenza insieme al danno inflitto ed elimina del tutto il termine relativo alla percentuale di vittorie.

WNX mantiene la struttura di WN8 e i rapporti rispetto ai valori attesi per veicolo, ma cambia ciò che conteggia. L'assistenza al tracciamento e quella radio vengono aggiunte al danno per due terzi del loro valore, così avvistare per un alleato e bloccare un cingolo vengono conteggiati per il contributo che rappresentano invece di essere ignorati.

Non include alcuna componente della percentuale di vittorie. I termini basati sull'esito favoriscono il gioco in plotone e gli account con molte battaglie più di quanto misurino il giocatore, quindi WNX valuta solo ciò che il giocatore ha fatto in battaglia: danni più assistenza, distruzioni e avvistamenti rispetto a ciò che ci si aspetta che produca il veicolo.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

L'esponente finale amplia la parte alta della scala, così la differenza tra un account valido e uno eccezionale resta visibile invece di comprimersi. ```

I valori attesi vengono ricalcolati a partire da un ampio campione di account monitorati. Questa è la valutazione predefinita su unicum.gg perché reagisce più rapidamente al modo in cui un veicolo viene effettivamente giocato oggi.
