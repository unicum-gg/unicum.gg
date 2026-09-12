---
term: Battles-based Stronghold Rating
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

Stronghold Rating, ki temelji na količini bitk, nagrajuje več kot zgolj dostop. 

SR namerno ignorira koliko igra klan. SRB vzame to oceno in jo pomnoži s pojmom, ki narašča z bitkami za njim, tako da je lahko vedno samo višja od SR, na kateri temelji.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmična, zato prvih sto bitk velja veliko več kot tisoča. ```

Ena količina, konstantna po vseh nivojih, namenoma: Škirmi Nivo X se igra neprekinjeno, medtem ko napadi potekajo v izbruhanju nekaj tednov na leto, tako da tisti nivoji, ki se dejansko igrajo več, dobijo večji bonus. To je ista ideja kot HRB ob HR na Steel Hunter tabeli.
