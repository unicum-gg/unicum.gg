---
term: WN7
aliases:
  - cote WN7
  - score WN7
related:
  - wn8
  - expected-values
  - average-tier
links:
  - target: top-players
anchors:
  labels:
    - WN7
---

Le prédécesseur de WN8 datant de 2012, calculé à partir des moyennes du compte et du rang moyen du joueur plutôt que des valeurs attendues pour chaque véhicule.

WN7 a été la première cote communautaire largement adoptée. Elle prend en compte cinq moyennes à l'échelle du compte, les frags, les dégâts, la détection, les points de défense et le taux de victoires, puis les corrige en fonction du rang moyen du compte, car les dégâts augmentent naturellement avec le rang.

Sa faiblesse réside dans cette correction elle-même. Le terme lié au rang est une courbe fixe plutôt qu'une mesure propre à chaque véhicule, il favorise donc certains rangs et en pénalise d'autres indépendamment des performances du joueur, et un compte de bas rang pouvait gonfler sa cote en progressant vers les rangs supérieurs. WN8 l'a remplacée en comparant individuellement les résultats obtenus avec chaque véhicule.

Elle subsiste parce qu'elle ne nécessite aucun jeu de données externe. WN7 peut être calculée à partir du résumé d'un compte, tandis que WN8 nécessite une table à jour des valeurs attendues, elle apparaît donc encore comme solution de repli et comme contrôle de cohérence.
