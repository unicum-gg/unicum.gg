---
term: WNX
aliases:
  - WNX rating
  - WNX vurdering
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

En moderne vurdering per kjøretøy som teller assistanseskade sammen med påført skade og helt dropper ønsket om seiersrate.

WNX beholder WN8s form, forhold mot forventede verdier per kjøretøy, og endrer hva den teller. Sporings- og radioassistanse legges til skade med to tredjedeler av verdien, så å spotte for en alliert og blokkere et belte poengsettes etter bidraget de utgjør i stedet for å bli ignorert.

Den har ingen seiersratekomponent. Utfall-baserte vilkår belønner platooning og lange kontoer mer enn de måler spilleren, så WNX scorer kun hva spilleren gjorde i kampen: skade pluss assistanse, frags og spots mot hva kjøretøyet er forventet å produsere.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Notatet: Eksponenten på halen strekker toppen av skalaen, så gapet mellom en god og en eksepsjonell konto forblir synlig i stedet for å bli komprimert. ```

De forventede verdiene kommer fra tomato.gg, som beregner dem på nytt fra et stort utvalg av sporede kontoer. Dette er den standard vurderingen på unicum.gg fordi den reagerer raskest på hvordan et kjøretøy faktisk spilles i dag.
