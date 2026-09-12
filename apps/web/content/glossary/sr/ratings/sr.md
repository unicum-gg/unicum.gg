---
term: Ocena jakog mesta
aliases:
  - SR
  - ocena sukoba
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

Ocena jakog mesta za performanse koristi unicum.gg: snaga roster-a pomnožena sa time koliko klan pobeđuje iznad proseka, uz isključivanje pojačanih roster-a.

Rezultati jakog mesta su teško uporedivi jer klan bira svoju opoziciju i njen obim. SR odgovara na uža pitanja: koliko je dobar ovaj roster i da li pobeđuje sa njim.

```formula
SR = snaga roster-a x (stopa pobede / 50%)^1.5 x (1 - udeo pojačanja)^1.5

Snaga roster-a je medijana lične ocene klana iznad 4.500. Medijana, ne prosek: ignoriše oba kraja niskih naloga i nekoliko carry-a. ```

Snaga roster-a se meri iznad takmičarske granice umesto od nule, tako da je razlika između prosečnog roster-a i elitnog dominirajući termin. Faktor pobede je neutralan na 50% i super-linearni, tako da dominiranje vredi više od minimalne prednosti.

Zadnji termin je anti-farming. Jake baze, posebno napredovanja, se igraju sa pojačanim nalozima: mali nalozi sa gotovo bez slučajnih bitaka koji postoje samo da popune roster jake baze. Ta odsutnost se ne može izvesti, tako da je roster pun njih snižen.

Obim uopšte nije uzet u obzir, što ga čini čistom ocenom veštine. Sprat bitke drži srećnu grupu igara van liste najboljih, a SRB je sestrinski termin koji nagrađuje obim.
