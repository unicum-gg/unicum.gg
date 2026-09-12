---
term: Stronghold Rating
aliases:
  - SR
  - valutazione skirmish
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

La valutazione delle performance del Stronghold utilizzata su unicum.gg: forza del roster moltiplicata per quanto un clan vince sopra la media, con roster potenziati esclusi.

I risultati del Stronghold sono difficili da confrontare perché un clan sceglie la propria opposizione e il proprio volume. SR risponde a una domanda più precisa: quanto è forte questo roster e vince con esso.

```formula
SR = forza del roster x (tasso di vittoria / 50%)^1.5 x (1 - quota di boost)^1.5

La forza del roster è il rating personale mediano del clan sopra 4.500. La mediana, non la media: ignora sia la coda bassa di conti piccoli sia un paio di carry. ```

La forza del roster è misurata sopra un pavimento competitivo piuttosto che da zero, quindi il divario tra un roster medio e uno d'élite è il termine dominante. Il fattore di vittoria è neutro al 50% e super-lineare, quindi dominare vale più che vincere di poco.

L'ultimo termine è quello anti-farming. I Strongholds, in particolare gli Advances, vengono giocati con conti boost: conti piccoli con quasi nessuna battaglia casuale che esistono solo per riempire un roster di Stronghold. Questa assenza non può essere falsificata, quindi un roster pieno di essi viene ridotto.

Il volume non è affatto considerato, il che rende questa una pura valutazione di abilità. Un pavimento di battaglia tiene un fortunato numero di partite fuori dalla classifica, e SRB è il fratello che premia il volume.
