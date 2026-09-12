---
term: WNX
aliases:
  - WNX rating
  - WNX-Wertung
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

Eine moderne fahrzeugspezifische Wertung, die Unterstützungsschaden zusätzlich zum verursachten Schaden berücksichtigt und die Siegrate vollständig aus der Berechnung entfernt.

WNX behält die Struktur von WN8 und die Verhältnisse zu den fahrzeugspezifischen Erwartungswerten bei, ändert aber, was berücksichtigt wird. Unterstützungsschaden durch Immobilisierung und Funkaufklärung wird zu zwei Dritteln seines Wertes zum Schaden addiert, sodass das Aufklären für einen Verbündeten und das Zerstören einer Kette als tatsächlicher Beitrag gewertet und nicht ignoriert werden.

Die Siegrate fließt nicht in die Wertung ein. Auf dem Gefechtsausgang basierende Faktoren belohnen Zugspiel und Konten mit vielen Gefechten stärker, als dass sie die Leistung des Spielers messen. Daher bewertet WNX nur, was der Spieler im Gefecht geleistet hat: Schaden plus Unterstützungsschaden, Abschüsse und aufgeklärte Gegner im Verhältnis zu den Erwartungswerten des Fahrzeugs.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Der Exponent am oberen Ende streckt den Spitzenbereich der Skala, sodass der Abstand zwischen einem guten und einem außergewöhnlichen Konto sichtbar bleibt, statt gestaucht zu werden. ```

Die Erwartungswerte stammen von tomato.gg, wo sie anhand einer großen Stichprobe erfasster Konten neu berechnet werden. Dies ist die Standardwertung auf unicum.gg, da sie am schnellsten darauf reagiert, wie ein Fahrzeug aktuell tatsächlich gespielt wird.
