---
term: Uz kauju skaitu balstīts Cietokšņa reitings
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

Tas ir Cietokšņa reitings, kurā kauju skaits tiek novērtēts, nevis tikai izmantots kā kvalifikācijas slieksnis, tāpēc klans, kas sevi pierādījis simtiem kauju, ierindojas augstāk par klanu ar tādu pašu SR, kas aizvadījis divdesmit kaujas.

SR apzināti neņem vērā, cik daudz kauju klans aizvada. SRB izmanto to pašu reitingu un reizina to ar koeficientu, kas pieaug līdz ar aizvadīto kauju skaitu, tāpēc tas vienmēr var būt tikai augstāks par SR, uz kura tas balstīts.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmiska sakarība, tāpēc pirmajām simt kaujām ir daudz lielāka vērtība nekā tūkstošajai. ```

Visiem līmeņiem apzināti izmantota viena kauju skaita konstante: Sadursmes X līmenī spēlē nepārtraukti, savukārt Uzbrukumi norisinās periodiski dažas nedēļas gadā, tāpēc līmeņi, kuros patiešām spēlē vairāk, saņem lielāku bonusu. Kauju skaita bonuss nošķir klanu, kas saglabājis reitingu simtiem kauju, no klana, kas to sasniedzis divdesmit kaujās.
