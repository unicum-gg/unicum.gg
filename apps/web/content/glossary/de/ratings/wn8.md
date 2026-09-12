---
term: WN8
aliases:
  - WN8-Wertung
  - WN8-Wert
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

Eine Leistungswertung der Community, die einen Spieler anhand des Schadens, der Abschüsse, der Aufklärung und der Basisverteidigung bewertet, die für die von ihm tatsächlich gespielten Fahrzeuge erwartet werden, und zusätzlich die Siegrate einbezieht.

WN8 beantwortet eine Frage, die ein einfacher Durchschnittswert nicht beantworten kann. Sind 1,800 Schaden pro Gefecht gut? Bei einem schweren Panzer der Stufe X ist das nichts Besonderes, bei einem mittleren Panzer der Stufe V ist es außergewöhnlich. WN8 vergleicht jedes Fahrzeug eines Kontos mit dem Serverdurchschnitt für genau dieses Fahrzeug, sodass ein Spieler, der überwiegend Stufe VI fährt, mit Stufe VI statt mit der gesamten Spielerschaft verglichen wird.

WN8 wurde 2013 vom WN-Team als Nachfolger von WN7 veröffentlicht, dessen Stufenabzug leicht zu manipulieren war. Fünf Verhältnisse fließen ein: Schaden, Abschüsse, Aufklärung, zurückgesetzte Eroberungspunkte und Siegrate, jeweils geteilt durch den Erwartungswert für die gespielten Fahrzeuge, mit einer Untergrenze von null und einer Begrenzung anhand des Schadensterms, damit ein einzelner starker Bereich nicht den Rest ausgleichen kann.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Jedes Verhältnis ist hier die korrigierte Form: Das Rohverhältnis wird um seine Untergrenze verschoben und auf das Schadensverhältnis begrenzt, mit dem es multipliziert wird. ```

Schaden macht ungefähr drei Viertel der Gewichtung aus, was auch der übliche Kritikpunkt ist: Ein passiver Spieler, der aus der Distanz Schaden farmt, erzielt eine bessere Wertung, als seine Zahlen rechtfertigen. Der Siegraten-Term ist auf 1.8 begrenzt, damit ein starker Zug ein schwaches Konto nicht unbegrenzt aufwerten kann.

Da die Erwartungswerte eine Momentaufnahme des Servers sind, verändert sich WN8 mit der Spielerschaft und den Fahrzeugen. Wird ein Panzer verbessert, steigt beim nächsten Datensatz-Update die Messlatte für alle, die ihn fahren. WN8 wird außerdem über die gesamte Historie eines Kontos kumuliert, weshalb einige Tausend frühe Gefechte auch Jahre später noch ins Gewicht fallen und die meisten Spieler stattdessen ihre aktuelle WN8 beobachten.
