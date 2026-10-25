---
term: WNX
aliases:
  - WNX rating
  - WNX-vurdering
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

En moderne vurdering per kjøretøy som teller assistanseskade sammen med skade påført og utelater seiersrate helt.

WNX beholder WN8s struktur og forholdstall mot forventede verdier per kjøretøy, men endrer hva som telles. Belte- og radioassistanse legges til skaden med to tredeler av verdien, slik at det å oppdage fiender for en alliert og å skade beltet deres gir poeng for bidraget de faktisk er, i stedet for å bli ignorert.

Den har ingen seiersratekomponent. Resultatbaserte begreper belønner troppespill og lange kontoer mer enn de måler spilleren, så WNX vurderer bare det spilleren gjorde i kampen: skade pluss assistanse, ødeleggelser og oppdagelser sammenlignet med det kjøretøyet forventes å oppnå.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Eksponenten på slutten strekker toppen av skalaen, slik at forskjellen mellom en god og en eksepsjonell konto fortsatt er synlig i stedet for å bli komprimert. ```

De forventede verdiene beregnes på nytt fra et stort utvalg sporede kontoer. Dette er standardvurderingen på unicum.gg fordi den reagerer raskest på hvordan et kjøretøy faktisk spilles i dag.
