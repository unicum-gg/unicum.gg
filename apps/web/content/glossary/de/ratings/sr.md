---
term: Bollwerkwertung
aliases:
  - SR
  - Scharmützelwertung
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

Die auf unicum.gg verwendete Bollwerk-Leistungswertung ist die Aufstellungsstärke multipliziert mit dem Maß, um das die Siegesquote eines Clans über einer ausgeglichenen Bilanz liegt, wobei Aufstellungen mit Boost-Accounts abgewertet werden.

Bollwerkergebnisse sind schwer zu vergleichen, weil ein Clan seine Gegner und sein Gefechtsvolumen selbst bestimmt. SR beantwortet eine engere Frage: Wie gut ist diese Aufstellung, und gewinnt sie damit?

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Die Aufstellungsstärke ist der Median der Persönlichen Wertung der Clanmitglieder über 4,500. Verwendet wird der Median, nicht der Mittelwert: Er ist sowohl gegenüber dem unteren Ende aus kleinen Accounts als auch gegenüber einigen wenigen Trägern unempfindlich. ```

Die Aufstellungsstärke wird oberhalb einer wettbewerbsfähigen Mindestgrenze statt ab null gemessen, sodass der Abstand zwischen einer durchschnittlichen und einer erstklassigen Aufstellung der dominierende Faktor ist. Der Siegesfaktor ist bei 50% neutral und steigt überlinear, sodass Dominanz mehr zählt als ein knapper Vorsprung.

Der letzte Faktor verhindert Farming. Bollwerkgefechte, insbesondere Vorstöße, werden mit Boost-Accounts gespielt: kleinen Accounts mit fast keinen Zufallsgefechten, die nur dazu dienen, eine Bollwerkaufstellung zu füllen. Dieses Fehlen lässt sich nicht vortäuschen, daher wird eine Aufstellung mit vielen solchen Accounts abgewertet.

Das Gefechtsvolumen fließt überhaupt nicht ein, was SR zu einer reinen Fähigkeitswertung macht. Eine Mindestzahl an Gefechten hält eine glückliche Handvoll Spiele von der Bestenliste fern, und SRB ist die verwandte Wertung, die Gefechtsvolumen belohnt.
