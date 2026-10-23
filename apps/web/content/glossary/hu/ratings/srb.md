---
term: Csataszám-alapú Erődítmény-értékelés
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - mr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Az Erődítmény-értékelés olyan változata, amelyben a csaták száma nem pusztán feltétel, hanem jutalmat is jelent, így egy több száz csatában bizonyított klán előrébb kerül a rangsorban, mint egy ugyanolyan SR-rel rendelkező, húsz csatát játszó klán.

Az SR szándékosan figyelmen kívül hagyja, hogy mennyit játszik egy klán. Az SRB ugyanezt az értékelést megszorozza egy olyan tényezővel, amely az alapjául szolgáló csaták számával nő, így csakis magasabb lehet, mint az alapjául szolgáló SR.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmikus, ezért az első száz csata sokkal többet ér, mint az ezredik. ```

Szándékosan egyetlen, minden szinten azonos csataszám-állandó érvényes: a X-es szintű Csatározást folyamatosan játsszák, míg az Előrenyomulások évente néhány héten, időszakosan zajlanak, így a ténylegesen többet játszott szintek nagyobb bónuszt kapnak. A csataszámért járó bónusz különbözteti meg azt a klánt, amely több száz csatán át tartott egy értékelést, attól, amely húsz csata alatt érte el.
