---
term: Moduswertung
aliases:
  - MR
  - Modus-Rating
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

Die von unicum.gg für die Gefechtsmodi außerhalb der Zufallsgefechte verwendete Leistungswertung, die auf der Durchschnittserfahrung pro Gefecht und der Siegrate basiert, wobei beide Werte mit dem Median der Spieler dieses Modus verglichen werden.

WN7, WN8 und WNX können dort nicht verwendet werden. Alle drei basieren auf einem in Zufallsgefechten ermittelten Erwartungswert für den Schaden, sodass ein Scharmützel in der Festung wie ein Zufallsgefecht bewertet wird, das niemand hätte spielen können: Der Modus ist kürzer und auf bestimmte Stufen begrenzt, wodurch der Schaden eines guten Spielers nur einen Bruchteil seines Durchschnitts in Zufallsgefechten beträgt, während seine Siegrate bei fast 90% liegt. Bei der Messung mit einem Fahrzeug erzielte derselbe Spieler im Scharmützel 1,794 WNX gegenüber 4,708 in Zufallsgefechten, bei 89.5% Siegen gegenüber 71.9%. Die ehrliche Antwort ist kein korrigiertes WN8, sondern eine andere Frage, und MR stellt sie: Wie schneidet dieser Spieler im Vergleich zu den Spielern dieses Modus ab?

MR verwendet zwei Achsen. Die Durchschnittserfahrung pro Gefecht dient als Maß für die Effektivität, weil die Erfahrungspunkteformel des Spiels bereits Schaden, Abschüsse, Aufklärung und Überlebenszeit berücksichtigt, sodass separate Achsen dasselbe Gefecht doppelt zählen würden. Die Siegrate ist das Ergebnis. Jeder Wert wird durch den eigenen Median des Modus geteilt, beide werden gleich gewichtet, und anschließend wertet ein Volumenfaktor eine kleine Stichprobe ab, damit hundert Gefechte in einer Rangliste nicht vor jemandem mit Tausenden liegen können.

Eine letzte Division macht den Wert übertragbar: Die Wertung wird anhand des moduseigenen Medians skaliert, sodass **1000 in jedem Modus dem Median der Spieler entspricht**. Ohne sie wären die Modi selbst nach der Normalisierung der beiden Achsen nicht vergleichbar, weil der Volumenfaktor die Anzahl der Gefechte berücksichtigt und die Modi in völlig unterschiedlichen Umfängen gespielt werden: Bei einer Messung auf EU reichte der Medianwert von 893 in Clankriege VI bis 1300 im Scharmützel, wodurch ein durchschnittlicher Spieler im Scharmützel grün und ein durchschnittlicher Spieler in anderen Modi orange dargestellt würde, obwohl beide denselben Rang einnehmen.

MR erhebt keinen Anspruch auf Vergleichbarkeit mit WN8. Diese Wertungen messen einen Spieler an der gesamten Spielerbasis. MR misst ihn dagegen an einer selbstgewählten Gruppe, und in einem Modus, der starke Spieler anzieht, liegt die Messlatte höher als in einem Modus, bei dem das nicht der Fall ist. MR zeigt, wo du unter den Spielern stehst, denen du dort tatsächlich begegnest.
