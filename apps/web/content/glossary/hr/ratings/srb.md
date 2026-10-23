---
term: Ocjena Utvrde na temelju bitaka
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

Ocjena Utvrde koja nagrađuje broj bitaka umjesto da ga koristi samo kao uvjet, pa je klan koji se dokazao tijekom stotina bitaka rangiran iznad klana s istim SR-om ostvarenim tijekom dvadeset bitaka.

SR namjerno zanemaruje koliko klan igra. SRB uzima tu istu ocjenu i množi je faktorom koji raste s brojem odigranih bitaka, pa nikada ne može biti niži od SR-a na kojem se temelji.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Rast je logaritamski, pa prvih sto bitaka vrijedi mnogo više od tisućite. ```

Namjerno se primjenjuje jedna konstanta broja bitaka za sve razine: Okršaji na razini X igraju se neprekidno, dok se Napretci održavaju u naletima tijekom nekoliko tjedana godišnje, pa razine koje se doista igraju više dobivaju veći bonus. Bonus za broj bitaka razlikuje klan koji je održao ocjenu tijekom stotina bitaka od klana koji ju je dosegnuo tijekom dvadeset.
