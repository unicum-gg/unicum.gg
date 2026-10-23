---
term: Ranking Twierdzy oparty na liczbie bitew
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

Ranking Twierdzy, który premiuje liczbę rozegranych bitew, zamiast jedynie wymagać ich minimalnej liczby, dzięki czemu klan sprawdzony w setkach bitew zajmuje wyższe miejsce niż klan z takim samym SR osiągniętym w dwudziestu bitwach.

SR celowo nie uwzględnia tego, jak często gra klan. SRB bierze ten sam ranking i mnoży go przez czynnik rosnący wraz z liczbą rozegranych bitew, więc zawsze może być tylko wyższy od SR, na którym się opiera.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Wzrost jest logarytmiczny, więc pierwsze sto bitew ma znacznie większą wartość niż tysięczna. ```

Celowo zastosowano jedną stałą liczby bitew dla wszystkich poziomów: Potyczki X poziomu są rozgrywane stale, podczas gdy Natarcia odbywają się seriami przez kilka tygodni w roku, więc poziomy, na których faktycznie rozgrywa się więcej bitew, zapewniają większą premię. Premia za liczbę bitew odróżnia klan, który utrzymywał dany ranking przez setki bitew, od klanu, który osiągnął go w dwudziestu.
