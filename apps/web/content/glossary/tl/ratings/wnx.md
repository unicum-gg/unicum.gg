---
term: WNX
aliases:
  - WNX rating
  - rating ng WNX
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

Isang modernong rating para sa bawat sasakyan na binibilang ang assistance damage kasama ang damage dealt at tuluyang inaalis ang win rate na termino.

Ang WNX ay nagpapanatili ng anyo ng WN8, ang mga ratio laban sa mga inaasahang halaga para sa bawat sasakyan, at binabago ang mga binibilang na. Ang tracking at radio assistance ay idinadagdag sa damage sa dalawang ikatlong bahagi ng kanilang halaga, kaya ang pagpapansin para sa isang kasamahan at pag-block sa isang track ay binibigyang halaga bilang kontribusyon na nararapat sa halip na pabayaan.

Wala itong bahagi ng win rate. Ang mga outcome-based na termino ay pahalagahan ang platooning at mga mahabang account higit sa pagsukat sa player, kaya ang WNX ay nag-i-score lamang sa ginawa ng player sa laban: damage kasama ang assistance, frags at spots laban sa inaasahang produksyon ng sasakyan.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Ang tail exponent ay nagpapahaba sa itaas ng scale, kaya ang agwat sa pagitan ng isang magandang account at isang pambihirang account ay nananatiling nakikita sa halip na kumikilos. ```

Ang mga inaasahang halaga ay nagmula sa tomato.gg, na nire-recompute ito mula sa isang malaking sample ng mga na-tracked na account. Ito ang default na rating sa unicum.gg dahil ito ay mabilis na tumutugon sa kung paano talaga nilalaro ang isang sasakyan sa ngayon.
