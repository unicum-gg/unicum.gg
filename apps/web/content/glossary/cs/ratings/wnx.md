---
term: WNX
aliases:
  - WNX rating
  - hodnocení WNX
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

Moderní hodnocení podle vozidla, které započítává poškození asistencí spolu s uděleným poškozením a zcela vypouští složku míry vítězství.

WNX zachovává strukturu WN8, poměry vůči očekávaným hodnotám pro jednotlivá vozidla a mění to, co započítává. Poškození asistencí za odhalení a za znehybnění se k poškození přičítá ve výši dvou třetin, takže odhalování pro spojence a blokování pásů se hodnotí jako skutečný přínos, nikoli jako něco, co se ignoruje.

Nemá složku míry vítězství. Hodnocení založená na výsledku zvýhodňují hraní v četě a dlouhodobě aktivní účty více, než měří samotného hráče, takže WNX hodnotí pouze to, co hráč v bitvě udělal: poškození spolu s asistencí, zničená vozidla a odhalení v porovnání s tím, co se od daného vozidla očekává.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Exponent na konci roztahuje horní část stupnice, takže rozdíl mezi dobrým a výjimečným účtem zůstává viditelný, místo aby se stlačil. ```

Očekávané hodnoty se přepočítávají z velkého vzorku sledovaných účtů. Jde o výchozí hodnocení na unicum.gg, protože nejrychleji reaguje na to, jak se s daným vozidlem skutečně hraje dnes.
