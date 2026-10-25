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

Isang makabagong rating bawat sasakyan na binibilang ang damage mula sa assistance kasama ng direktang damage at tuluyang inaalis ang bahagi para sa win rate.

Pinananatili ng WNX ang estruktura ng WN8 at ang mga ratio laban sa inaasahang halaga bawat sasakyan, pero binabago nito ang binibilang. Idinadagdag ang tracking at radio assistance sa damage sa dalawang-katlo ng halaga ng mga ito, kaya ang pag-spot para sa kakampi at pagharang sa track ay binibigyan ng puntos ayon sa tunay na ambag ng mga ito sa halip na hindi isama.

Wala itong bahagi para sa win rate. Mas napapaboran ng mga terminong batay sa resulta ang paglalaro sa platoon at matatagal nang account kaysa sa aktuwal na pagsukat sa manlalaro, kaya binibigyan lamang ng WNX ng puntos ang ginawa ng manlalaro sa labanan: damage kasama ang assistance, mga frag at mga spot kumpara sa inaasahang kayang gawin ng sasakyan.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Pinapahaba ng exponent sa dulo ang itaas na bahagi ng scale, kaya nananatiling kapansin-pansin ang agwat ng isang mahusay at isang pambihirang account sa halip na lumiit. ```

Muling kinakalkula ang mga inaasahang halaga mula sa malaking sample ng mga account na sinusubaybayan. Ito ang default na rating sa unicum.gg dahil pinakamabilis itong tumugon sa aktuwal na paraan ng paggamit sa isang sasakyan sa kasalukuyan.
