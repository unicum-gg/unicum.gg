---
term: Rejting Utvrde zasnovan na bitkama
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

Rejting Utvrde u kojem se obim bitaka nagrađuje, a ne služi samo kao uslov, tako da je klan koji se dokazao kroz stotine bitaka rangiran iznad klana s istim SR-om ostvarenim kroz dvadeset bitaka.

SR namjerno zanemaruje koliko klan igra. SRB uzima taj isti rejting i množi ga faktorom koji raste s brojem odigranih bitaka, pa može biti samo veći od SR-a na kojem se zasniva.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritamski, pa prvih stotinu bitaka vrijedi mnogo više od hiljadite. ```

Jedna konstanta obima za svaki nivo, namjerno: Okršaj nivoa X igra se neprekidno, dok se Napredovanja održavaju u naletima nekoliko sedmica godišnje, pa nivoi na kojima se zaista više igra dobijaju veći bonus. Bonus za obim razlikuje klan koji je održavao rejting kroz stotine bitaka od klana koji ga je dostigao kroz dvadeset.
