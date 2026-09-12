---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
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

Ocjena performansi Stronghold koja se koristi na unicum.gg: snaga rostera pomnožena s koliko je klan iznad prosječne razine, s umanjenim rosterskim snagama.

Rezultati Strongholda su teški za usporedbu jer klan bira svoju protivničku ekipu i svoj broj igrača. SR odgovara na uži upit: koliko je dobar ovaj roster i pobjeđuje li s njim.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength je medijan Osobnog Ocjenjivanja klana iznad 4,500. Medijan, a ne prosjek: odbacuje i donji rep malih računa i nekoliko carry računala. ```

Snaga rostera mjeri se iznad konkurentskog praga, a ne od nule, tako da je razlika između prosječnog rostera i elitnog dominirajući pojam. Faktor pobjede je neutralan na 50% i super-linearno, pa je dominacija vrijednija od malog pomaka.

Zadnji pojam je onaj protiv farminga. Strongholdi, posebno Napadi, igraju se s boost računima: mali računi s gotovo bez slučajnih bitaka koji postoje samo kako bi popunili roster strongholda. Ta odsutnost se ne može fiktivno prikazati, pa se roster pun njih smanjuje.

Zapremina uopće nije uključena, što ga čini čistom ocjenom vještine. Tavan za bitke drži sretnu manjinu igara izvan ljestvice, a SRB je brat koji nagrađuje zapreminu.
