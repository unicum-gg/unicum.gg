---
term: Classement du Bastion basé sur les batailles
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

Le classement du Bastion qui récompense le nombre de batailles au lieu d'en faire un simple seuil, afin qu'un clan ayant fait ses preuves sur des centaines de batailles soit mieux classé qu'un clan ayant le même SR après seulement vingt batailles.

Le SR ne tient délibérément pas compte du nombre de parties disputées par un clan. Le SRB reprend ce même classement et le multiplie par un terme qui augmente avec le nombre de batailles jouées, il ne peut donc jamais être inférieur au SR sur lequel il repose.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

La progression est logarithmique, les cent premières batailles valent donc bien plus que la millième. ```

Une seule constante de volume pour tous les rangs, et ce volontairement : l'Escarmouche de rang X se joue en continu, tandis que les Incursions sont disputées par périodes quelques semaines par an, de sorte que les rangs réellement les plus joués obtiennent un bonus plus important. Le bonus de volume distingue un clan qui a maintenu un classement pendant des centaines de batailles d'un autre qui l'a atteint en vingt batailles.
