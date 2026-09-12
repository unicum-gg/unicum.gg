---
term: Ocjena temeljen na borbama
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - hr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Ocjena temeljen na borbama je ocjena koja nagrađuje volumen borbi umjesto da ga samo ograničava, tako da klan koji se dokazao kroz stotine bitaka zauzima više mjesto od onog koji ima istu SR preko dvadeset.

SR namjerno zanemaruje koliko klan igra. SRB uzima tu istu ocjenu i množi je sa terminom koji raste sa borbama iza njega, tako da može biti samo veća od SR na kojoj se oslanja.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritamski, tako da su prve stotine bitaka mnogo vrednije od hiljadite. ```

Jedna konstanata volumena preko svih nivoa, namjerno: Skirmish Tier X se igra kontinuirano dok se Advances odvijaju u kratkim intervalima nekoliko nedelja godišnje, tako da nivoi koji se stvarno više igraju zarađuju veći bonus. To je ista ideja kao HRB pored HR na Steel Hunter tabli.
