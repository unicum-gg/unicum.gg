---
term: Hodnocení Opevnění
aliases:
  - SR
  - hodnocení šarvátek
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

Hodnocení výkonu v režimu Opevnění používané na unicum.gg: síla sestavy vynásobená tím, nakolik klan překonává 50% míru vítězství, přičemž sestavy s boostovacími účty jsou penalizovány.

Výsledky v Opevnění se těžko porovnávají, protože klan si volí soupeře i počet bitev. SR odpovídá na užší otázku: jak dobrá je tato sestava a zda s ní klan vítězí.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Síla sestavy je medián osobního hodnocení členů klanu nad 4,500. Používá se medián, nikoli průměr: ten omezuje vliv jak spodní části tvořené malými účty, tak několika tahounů. ```

Síla sestavy se měří nad soutěžní spodní hranicí, nikoli od nuly, takže rozdíl mezi průměrnou a elitní sestavou je rozhodujícím faktorem. Faktor vítězství je neutrální při 50% a roste nadlineárně, takže dominance má větší hodnotu než těsné překonání soupeře.

Poslední člen slouží proti farmení. Opevnění, zejména Advances, se hrají s boostovacími účty: malými účty s téměř žádnými náhodnými bitvami, které existují pouze k doplnění sestavy pro Opevnění. Tuto absenci nelze předstírat, takže sestava plná takových účtů dostane nižší hodnocení.

Počet bitev se vůbec nezohledňuje, což z něj dělá čisté hodnocení dovedností. Minimální počet bitev zabrání tomu, aby se na žebříček dostala šťastná hrstka her, zatímco příbuzné hodnocení SRB odměňuje objem.
