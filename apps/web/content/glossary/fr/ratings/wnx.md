---
term: WNX
aliases:
  - WNX rating
  - évaluation WNX
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

Une cote moderne par véhicule qui comptabilise les dégâts d’assistance en plus des dégâts infligés et supprime complètement le taux de victoire.

WNX conserve la structure de WN8 et les ratios par rapport aux valeurs attendues pour chaque véhicule, tout en modifiant ce qui est comptabilisé. L’assistance de détection et de radio s’ajoute aux dégâts à hauteur de deux tiers de sa valeur, afin que le repérage pour un allié et l’immobilisation d’un adversaire soient évalués à la mesure de la contribution qu’ils représentent au lieu d’être ignorés.

Il ne comporte aucune composante de taux de victoire. Les composantes fondées sur l’issue de la bataille favorisent le jeu en peloton et les comptes anciens davantage qu’elles ne mesurent le joueur, donc WNX évalue uniquement ce que le joueur a fait pendant la bataille : dégâts plus assistance, éliminations et détections, comparés à ce que le véhicule est censé produire.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

L’exposant final étire le sommet de l’échelle, afin que l’écart entre un compte performant et un compte exceptionnel reste visible au lieu d’être compressé. ```

Les valeurs attendues sont recalculées à partir d’un vaste échantillon de comptes suivis. Il s’agit de la cote par défaut sur unicum.gg, car elle réagit le plus rapidement à la manière dont un véhicule est réellement joué aujourd’hui.
