---
term: WNX
aliases:
  - WNX rating
  - valoración WNX
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

Una valoración moderna por vehículo que cuenta el daño de asistencia junto con el daño infligido y elimina por completo el término de porcentaje de victorias.

WNX conserva la estructura de WN8 y las proporciones respecto a los valores esperados por vehículo, pero cambia lo que cuenta. La asistencia de detección y de inmovilización se suma al daño con un valor de dos tercios, de modo que detectar para un aliado y bloquear una oruga se puntúan como la contribución que realmente representan, en lugar de ignorarse.

No tiene ningún componente de porcentaje de victorias. Los términos basados en el resultado recompensan jugar en pelotón y tener cuentas antiguas más de lo que miden al jugador, así que WNX solo puntúa lo que el jugador hizo en la batalla: daño más asistencia, enemigos destruidos y detecciones, comparados con lo que se espera que produzca el vehículo.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

El exponente final estira la parte superior de la escala, de modo que la diferencia entre una cuenta buena y una excepcional siga siendo visible en lugar de comprimirse. ```

Los valores esperados se recalculan a partir de una muestra grande de cuentas registradas. Esta es la valoración predeterminada en unicum.gg porque reacciona con mayor rapidez a la forma en que realmente se juega un vehículo en la actualidad.
