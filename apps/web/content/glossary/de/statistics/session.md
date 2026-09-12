---
term: Spielsitzung
aliases:
  - Session
  - Sitzungsstatistiken
  - Tagesstatistiken
  - session stats
  - daily stats
related:
  - recent-stats
  - battles
  - coverage
---

Ein Block von Gefechten, die am Stück gespielt wurden und von einem Tracker anhand der Differenz zwischen zwei Momentaufnahmen eines Kontos rekonstruiert werden.

Die API von Wargaming liefert die Gesamtwerte eines Kontos, nicht die einzelnen Gefechte. Ein Tracker erstellt regelmäßig Momentaufnahmen dieser Gesamtwerte, und die Differenz zwischen zwei Momentaufnahmen entspricht genau den dazwischen gespielten Gefechten samt Schaden, Abschüssen und Ergebnissen.

Diese Differenz ist eine Spielsitzung. So kann eine Website anzeigen, was ein Spieler heute getan hat, statt alles, was er seit 2013 getan hat, und auf dieser Grundlage werden aktuelle Wertungen berechnet.

Ihre zeitliche Auflösung hängt davon ab, wie oft eine Momentaufnahme des Kontos erstellt wird, daher ist eine Spielsitzung ein Spielblock und kein genauer Start- und Endzeitraum, und ein direkt vor einer Momentaufnahme gespieltes Gefecht fällt in die Spielsitzung dieser Momentaufnahme.
