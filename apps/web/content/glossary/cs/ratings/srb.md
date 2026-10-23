---
term: Hodnocení Pevnosti založené na počtu bitev
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

Hodnocení Pevnosti, které odměňuje počet odehraných bitev, místo aby jej používalo pouze jako podmínku, takže klan, který se osvědčil ve stovkách bitev, se umístí výše než klan se stejným SR dosaženým ve dvaceti bitvách.

SR záměrně nezohledňuje, kolik toho klan odehraje. SRB používá stejné hodnocení a násobí je členem, který roste s počtem odehraných bitev, takže může být vždy pouze vyšší než SR, ze kterého vychází.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logaritmický růst znamená, že prvních sto bitev má mnohem větší hodnotu než tisící bitva. ```

Pro všechny úrovně se záměrně používá jedna konstanta počtu bitev. Šarvátka X. úrovně se hraje nepřetržitě, zatímco Ofenzívy probíhají v nárazech několik týdnů v roce, takže více hrané úrovně získávají větší bonus. Bonus za počet bitev odlišuje klan, který si udržel hodnocení po stovky bitev, od klanu, který ho dosáhl ve dvaceti bitvách.
