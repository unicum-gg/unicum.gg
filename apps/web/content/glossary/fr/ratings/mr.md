---
term: Cote par mode
aliases:
  - MR
  - mode rating
  - cote de mode
  - indice de mode
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

La cote de performance qu’unicum.gg utilise pour les modes de bataille autres que les Batailles aléatoires, calculée à partir de l’expérience moyenne par bataille et du taux de victoires, chacun étant comparé à la médiane des joueurs de ce mode.

WN7, WN8 et WNX ne peuvent pas y être utilisés. Tous trois reposent sur une valeur de dégâts attendus mesurée dans les batailles aléatoires, si bien qu’une Escarmouche de Bastion est évaluée comme une bataille aléatoire que personne n’aurait pu jouer : le mode est plus court et limité en rang, ce qui réduit les dégâts d’un bon joueur à une fraction de sa moyenne en Batailles aléatoires tandis que son taux de victoires avoisine 90%. Sur un même véhicule, le même joueur a obtenu 1,794 WNX en Escarmouche contre 4,708 en Batailles aléatoires, avec 89.5% de victoires contre 71.9%. La réponse honnête n’est pas un WN8 corrigé, mais une autre question, celle que pose MR : comment ce joueur se situe-t-il par rapport aux joueurs de ce mode.

Elle utilise deux axes. L’expérience moyenne par bataille est l’indicateur d’efficacité, car la formule d’expérience du jeu prend déjà en compte les dégâts, les destructions, la détection et le temps de survie, de sorte que des axes distincts compteraient deux fois la même bataille. Le taux de victoires représente le résultat. Chacun est divisé par la médiane propre au mode, ils ont le même poids, puis un facteur de volume réduit la valeur d’un petit échantillon afin qu’une centaine de batailles ne permette pas de devancer dans le classement un joueur qui en compte des milliers.

Une dernière division rend le nombre transposable : le score est rapporté au score médian propre au mode, de sorte que **1000 correspond au joueur médian dans chaque mode**. Sans elle, les modes ne seraient pas comparables même après normalisation des deux axes, car le facteur de volume repose sur un nombre de batailles et les volumes de jeu varient énormément selon les modes : sur EU, le score médian allait de 893 dans les Guerres de clans VI à 1300 en Escarmouche, ce qui afficherait en vert un joueur moyen d’Escarmouche et en orange un joueur moyen d’un autre mode pour un classement équivalent.

MR ne prétend pas permettre une comparaison avec WN8. Ces indices évaluent un joueur par rapport à l’ensemble des joueurs, tandis que MR l’évalue par rapport à un groupe auto-sélectionné, et un mode qui attire des joueurs talentueux place la barre plus haut qu’un mode qui ne le fait pas. MR indique où vous vous situez parmi les joueurs que vous rencontrez réellement dans ce mode.
