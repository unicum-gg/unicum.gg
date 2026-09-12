---
term: Bodovna ocjena temeljenih na bitkama
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

Bodovna ocjena temeljenih na bitkama je ocjena koja nagrađuje volumen bitaka umjesto da ga samo ograničava, tako da klan koji se dokazao kroz stotine bitaka zauzima više mjesto od onog s istim SR koji igra samo dvadeset.

SR namjerno ignorira koliko klan igra. SRB uzima tu istu ocjenu i množi je s pojmom koji raste s bitkama iza nje, tako da može biti uvijek veća od SR na kojoj se temelji.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritamski, tako da je prvih stotinu bitaka vrijedno mnogo više od tisućite. ```

Jedna stalna vrijednost preko svih razina, namjerno: Skirmish Tier X se igra neprekidno dok Advances djeluje u praskama nekoliko tjedana godišnje, tako da razine koje se stvarno igraju više dobivaju veći bonus. To je ista ideja kao HRB pored HR na tabli Steel Hunter.
