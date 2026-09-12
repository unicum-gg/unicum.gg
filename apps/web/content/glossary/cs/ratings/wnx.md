---
term: WNX
aliases:
  - hodnocení WNX
  - WNX rating
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

Moderní hodnocení pro jednotlivá vozidla, které vedle způsobeného poškození započítává také poškození s asistencí a zcela vypouští složku míry vítězství.

WNX zachovává strukturu WN8 a poměry vůči očekávaným hodnotám jednotlivých vozidel, ale mění započítávané údaje. Poškození s asistencí za zničení pásu a odhalení se přičítá ke způsobenému poškození ve výši dvou třetin své hodnoty, takže odhalení nepřítele pro spojence a zničení pásu jsou hodnoceny jako skutečný přínos, místo aby byly ignorovány.

Neobsahuje žádnou složku míry vítězství. Složky založené na výsledku zvýhodňují hraní v četě a dlouhodobě hrané účty více, než měří hráče, takže WNX hodnotí pouze to, co hráč v bitvě udělal: poškození včetně asistence, zničení a odhalení v poměru k tomu, co se od daného vozidla očekává.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Exponent v chvostu roztahuje horní část stupnice, takže rozdíl mezi dobrým a výjimečným účtem zůstává viditelný, místo aby se zmenšoval. ```

Očekávané hodnoty pocházejí z tomato.gg, který je přepočítává z velkého vzorku sledovaných účtů. Jde o výchozí hodnocení na unicum.gg, protože nejrychleji reaguje na to, jak se s daným vozidlem skutečně hraje v současnosti.
