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

Una valutazione moderna per veicolo che conta il danno di assistenza accanto al danno inflitto e abbandona completamente il termine del tasso di vittoria.

WNX mantiene la forma di WN8, i rapporti rispetto ai valori attesi per veicolo e cambia cosa conta. L'assistenza tracciata e radio è aggiunta al danno a due terzi del loro valore, quindi il rilevamento per un alleato e il blocco di un cingolo sono valutati come il contributo che sono piuttosto che essere ignorati.

Non ha alcun componente di tasso di vittoria. I termini basati sul risultato premiano il gruppo e i conti lunghi più di quanto non misurino il giocatore, quindi WNX valuta solo quello che il giocatore ha fatto nella battaglia: danno più assistenza, uccisioni e rilevazioni contro ciò che il veicolo è previsto produrre.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Il'esponente finale allunga la parte superiore della scala, quindi il divario tra un buon e un eccezionale conto rimane visibile invece di comprimerlo. ```

I valori attesi provengono da tomato.gg, che li ricalcola da un ampio campione di conti tracciati. Questa è la valutazione predefinita su unicum.gg perché reagisce più rapidamente a come un veicolo viene effettivamente giocato oggi.
