---
term: Cote de Bastion
aliases:
  - SR
  - cote d’escarmouche
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

La cote de performance en Bastion utilisée sur unicum.gg correspond à la force de l’effectif multipliée par son niveau de victoires au-delà de l’équilibre, avec une décote pour les effectifs utilisant des comptes de boost.

Les résultats en Bastion sont difficiles à comparer, car un clan choisit ses adversaires et son volume de batailles. La SR répond à une question plus précise : quel est le niveau de cet effectif, et parvient-il à gagner avec lui.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

La force de l’effectif correspond à la part supérieure à 4,500 de la cote personnelle médiane du clan. C’est la médiane, et non la moyenne : elle résiste aussi bien à la longue traîne inférieure des petits comptes qu’à l’influence de quelques joueurs qui portent l’équipe. ```

La force de l’effectif est mesurée au-dessus d’un seuil compétitif plutôt qu’à partir de zéro, de sorte que l’écart entre un effectif moyen et un effectif d’élite constitue le terme dominant. Le facteur de victoire est neutre à 50% et superlinéaire, si bien que dominer rapporte davantage que gagner de justesse.

Le dernier terme sert à empêcher le farming. Les Bastions, et surtout les Incursions, sont joués avec des comptes de boost : de petits comptes ayant disputé très peu de batailles aléatoires et qui existent uniquement pour compléter un effectif de Bastion. Cette absence ne peut pas être simulée, donc la cote d’un effectif qui en compte beaucoup est réduite.

Le volume n’entre absolument pas dans le calcul, ce qui en fait une pure cote de niveau. Un nombre minimal de batailles empêche une poignée de parties chanceuses d’apparaître au classement, tandis que la SRB est son équivalent qui récompense le volume.
