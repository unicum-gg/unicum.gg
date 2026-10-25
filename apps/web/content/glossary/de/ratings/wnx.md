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

Eine moderne Wertung pro Fahrzeug, die Unterstützungsschaden zusammen mit verursachtem Schaden zählt und den Begriff Siegesrate vollständig weglässt.

WNX behält die Struktur von WN8, Verhältnisse im Vergleich zu fahrzeugspezifischen Erwartungswerten und ändert, was gezählt wird. Tracking- und Funkunterstützung werden zu zwei Dritteln ihres Wertes zum Schaden addiert, sodass das Aufklären für einen Verbündeten und das Blockieren einer Kette als der Beitrag gewertet werden, der sie sind, statt ignoriert zu werden.

Sie enthält keine Komponente für die Siegesrate. Ergebnisbasierte Begriffe belohnen Zugfahren und lange bestehende Konten stärker, als sie den Spieler messen, daher bewertet WNX nur, was der Spieler im Gefecht getan hat: Schaden plus Unterstützung, Abschüsse und Aufklärung im Vergleich zu dem, was vom Fahrzeug erwartet wird.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Der Exponent am Ende streckt den oberen Bereich der Skala, sodass der Abstand zwischen einem guten und einem außergewöhnlichen Konto sichtbar bleibt, anstatt zusammengedrückt zu werden. ```

Die Erwartungswerte werden aus einer großen Stichprobe erfasster Konten neu berechnet. Dies ist die Standardwertung auf unicum.gg, weil sie am schnellsten darauf reagiert, wie ein Fahrzeug heute tatsächlich gespielt wird.
