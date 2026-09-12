---
term: WNX
aliases:
  - cote WNX
  - classement WNX
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

Une cote moderne calculée par véhicule qui comptabilise les dégâts par assistance avec les dégâts infligés et supprime entièrement le facteur de taux de victoire.

WNX conserve la structure de WN8 et ses ratios par rapport aux valeurs attendues pour chaque véhicule, mais modifie les éléments comptabilisés. Les dégâts par assistance à l'immobilisation et par assistance radio sont ajoutés aux dégâts à hauteur des deux tiers de leur valeur, afin que repérer un adversaire pour un allié et détruire une chenille soient considérés comme de véritables contributions au lieu d'être ignorés.

Il ne comporte aucun facteur lié au taux de victoire. Les facteurs fondés sur le résultat récompensent davantage le jeu en peloton et les comptes anciens qu'ils ne mesurent le joueur, donc WNX évalue uniquement ce que le joueur a accompli au combat, à savoir les dégâts plus l'assistance, les destructions et les détections par rapport aux résultats attendus du véhicule.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

L'exposant final étire le haut de l'échelle, de sorte que l'écart entre un bon compte et un compte exceptionnel reste visible au lieu d'être comprimé. ```

Les valeurs attendues proviennent de tomato.gg, qui les recalcule à partir d'un vaste échantillon de comptes suivis. Il s'agit de la cote par défaut sur unicum.gg, car elle s'adapte le plus rapidement à la manière dont un véhicule est réellement joué aujourd'hui.
