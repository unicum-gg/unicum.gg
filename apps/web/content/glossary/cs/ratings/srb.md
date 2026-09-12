---
term: Hodnocení opevnění podle počtu bitev
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

Hodnocení opevnění, které počet odehraných bitev odměňuje, místo aby ho používalo jen jako podmínku, takže klan, který se osvědčil ve stovkách bitev, je v žebříčku výše než klan se stejným SR po dvaceti bitvách.

SR záměrně nebere v úvahu, jak často klan hraje. SRB toto hodnocení násobí členem, který roste s počtem odehraných bitev, takže nikdy nemůže být nižší než SR, z něhož vychází.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Růst je logaritmický, takže prvních sto bitev má mnohem větší hodnotu než tisící bitva. ```

Pro všechny úrovně je záměrně použita jedna konstanta objemu: Šarvátky X. úrovně se hrají nepřetržitě, zatímco Postupy probíhají v nárazových obdobích po několik týdnů v roce, takže více hrané úrovně získávají větší bonus. Jde o stejný princip jako u HRB vedle HR v žebříčku Ocelového lovce.
