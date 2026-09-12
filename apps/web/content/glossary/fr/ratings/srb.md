---
term: Cote de Bastion basée sur les batailles
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - hr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

La cote de Bastion qui récompense le volume de batailles au lieu de simplement l’utiliser comme seuil, de sorte qu’un clan qui a fait ses preuves au cours de centaines de batailles soit mieux classé qu’un clan ayant la même SR après seulement vingt batailles.

La SR ignore délibérément le nombre de batailles disputées par un clan. La SRB reprend cette même cote et la multiplie par un terme qui augmente avec le nombre de batailles disputées, elle ne peut donc être que supérieure à la SR sur laquelle elle repose.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

La progression est logarithmique, les cent premières batailles valent donc bien plus que la millième. ```

Une seule constante de volume s’applique à tous les rangs, à dessein : les Escarmouches de rang X se jouent en continu, tandis que les Incursions ont lieu par périodes pendant quelques semaines par an, de sorte que les rangs réellement les plus joués obtiennent un bonus plus élevé. C’est le même principe que celui de la HRB par rapport à la HR dans le classement de Traqueur d’acier.
