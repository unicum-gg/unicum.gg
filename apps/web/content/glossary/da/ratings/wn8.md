---
term: WN8
aliases:
  - WN8 rating
  - wn8 score
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

En fællesskabsydelsesvurdering, der scorer en spiller mod de skader, drab, spotting og basisforsvar, som forventes af de køretøjer, de faktisk spiller, med en sejrprocent som en del af beregningen.

WN8 besvarer et spørgsmål, som et rå gennemsnit ikke kan. Er 1.800 skade pr. kamp godt? På en Tier X tung er det usædvanligt, på en Tier V medium er det ganske fremragende. WN8 sammenligner hver køretøj på en konto med servergennemsnittet for det samme køretøj, så en spiller, der primært kører Tier VI, bliver målt mod Tier VI i stedet for mod hele populationen.

Det blev offentliggjort i 2013 af WN-teamet som efterfølger til WN7, hvis tier-sanktion gjorde det let at misbruge. Fem forhold føder det: skade, drab, spotting, tabte fangstpunkter og sejrprocent, hver divideret med den forventede værdi for de spillede køretøjer, gulvet sat til nul og begrænset i forhold til skadetermen, så en enkelt stærk akse ikke kan bære resten.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Hver forhold her er den korrigerede form: den rå forhold flyttet af dets gulv, klippet til det skadeforhold, det multiplicerer. ```

Skade bærer omtrent tre kvarter af vægten, hvilket er den sædvanlige klage over det: en passiv spiller, der farmer skade fra baglinjen, scorer bedre end tallene berettiger. Sejrprocenten er begrænset til 1.8, så en stærk platoon ikke kan oppuste en svag konto uendeligt.

Fordi de forventede værdier er et øjebliksbillede af serveren, driver WN8, når populationen og køretøjerne ændrer sig. Et tank, der får buffs, hæver niveauet for alle, der kører det ved den næste datasætopdatering. WN8 er også kumulativ over en kontos hele historie, så et par tusinde tidlige kampe fortsætter med at påvirke det mange år senere, hvilket er grunden til, at de fleste spillere holder øje med deres seneste WN8 i stedet.
