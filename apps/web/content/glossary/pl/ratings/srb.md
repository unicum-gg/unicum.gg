---
term: Ranking Twierdzy oparty na liczbie bitew
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

Ranking Twierdzy, który premiuje liczbę rozegranych bitew, zamiast jedynie wymagać minimalnej liczby, dzięki czemu klan, który sprawdził się w setkach bitew, zajmuje wyższą pozycję niż klan z takim samym SR po dwudziestu bitwach.

SR celowo nie uwzględnia tego, jak dużo gra klan. SRB wykorzystuje ten sam ranking i mnoży go przez czynnik, który rośnie wraz z liczbą rozegranych bitew, dlatego nigdy nie może być niższy od SR, na którym się opiera.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Wzrost jest logarytmiczny, więc pierwsze sto bitew ma znacznie większą wartość niż tysięczna. ```

Jedna stała liczby bitew obowiązuje celowo na każdym poziomie. Potyczki X poziomu są rozgrywane bez przerwy, podczas gdy Natarcia odbywają się seriami przez kilka tygodni w roku, dlatego poziomy, na których rzeczywiście gra się więcej, zapewniają większą premię. To ten sam pomysł co HRB obok HR w rankingu Stalowego łowcy.
