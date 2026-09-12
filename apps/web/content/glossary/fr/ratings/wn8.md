---
term: WN8
aliases:
  - cote WN8
  - score WN8
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

Une cote de performance créée par la communauté qui évalue un joueur selon les dégâts, les destructions, la détection et la défense de la base attendus pour les véhicules qu’il joue réellement, avec en plus un facteur lié au taux de victoires.

Le WN8 répond à une question à laquelle une moyenne brute ne peut pas répondre. Est-ce que 1,800 points de dégâts par bataille est un bon résultat ? Sur un char lourd de rang X, ce résultat est quelconque, tandis que sur un char moyen de rang V, il est exceptionnel. Le WN8 compare chaque véhicule d’un compte à la moyenne du serveur pour ce même véhicule, de sorte qu’un joueur qui conduit principalement des véhicules de rang VI est évalué par rapport au rang VI plutôt que par rapport à l’ensemble des joueurs.

Il a été publié en 2013 par l’équipe WN pour succéder au WN7, dont la pénalité liée au rang était facile à exploiter. Il repose sur cinq ratios : les dégâts, les destructions, la détection, les points de capture annulés et le taux de victoires, chacun étant divisé par la valeur attendue pour les véhicules joués, avec un minimum fixé à zéro et un plafonnement par rapport au facteur de dégâts afin qu’un seul domaine performant ne puisse pas compenser tous les autres.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Chaque ratio présenté ici est sa forme corrigée : le ratio brut est décalé selon son seuil minimal, puis limité par rapport au ratio de dégâts par lequel il est multiplié. ```

Les dégâts représentent environ trois quarts du poids total, ce qui constitue la critique la plus courante à son égard : un joueur passif qui accumule des dégâts depuis l’arrière obtient un meilleur score que ne le justifient ses performances. Le facteur lié au taux de victoires est plafonné à 1.8 afin qu’un peloton performant ne puisse pas gonfler indéfiniment les résultats d’un compte faible.

Comme les valeurs attendues constituent un instantané du serveur, le WN8 évolue à mesure que la population et les véhicules changent. Lorsqu’un char est amélioré, la barre monte pour tous ceux qui le conduisent à la mise à jour suivante du jeu de données. Le WN8 est également calculé de manière cumulative sur tout l’historique d’un compte, si bien que quelques milliers de batailles disputées au début continuent de peser sur lui des années plus tard, raison pour laquelle la plupart des joueurs surveillent plutôt leur WN8 récent.
