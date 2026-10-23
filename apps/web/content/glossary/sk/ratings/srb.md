---
term: Hodnotenie Pevnosti podľa počtu bitiek
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

Hodnotenie Pevnosti, ktoré odmeňuje počet odohraných bitiek namiesto toho, aby ho iba používalo ako podmienku, takže klan, ktorý sa osvedčil v stovkách bitiek, sa umiestni vyššie než klan s rovnakým SR po dvadsiatich bitkách.

SR zámerne nezohľadňuje, koľko klan hrá. SRB preberá rovnaké hodnotenie a násobí ho členom, ktorý rastie s počtom odohraných bitiek, takže môže byť vždy len vyššie než SR, z ktorého vychádza.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmický rast znamená, že prvých sto bitiek má omnoho väčšiu hodnotu než tisíca bitka. ```

Jeden koeficient počtu bitiek pre všetky úrovne, a to zámerne: Šarvátka úrovne X sa hrá nepretržite, zatiaľ čo Postupy prebiehajú nárazovo niekoľko týždňov v roku, takže úrovne, ktoré sa naozaj hrajú viac, získajú väčší bonus. Bonus za počet bitiek odlišuje klan, ktorý si udržal hodnotenie počas stoviek bitiek, od klanu, ktorý ho dosiahol po dvadsiatich.
