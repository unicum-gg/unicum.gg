---
term: WNX
aliases:
  - WNX rating
  - clasificación WNX
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

Una clasificación moderna por vehículo que cuenta el daño de asistencia junto con el daño infligido y elimina el término de tasa de victorias por completo.

WNX mantiene la estructura de WN8, las proporciones contra los valores esperados por vehículo, y cambia lo que cuenta. La asistencia de seguimiento y radio se añade al daño a dos tercios de su valor, así que el avistamiento para un aliado y el bloqueo de una pista se puntúan como la contribución que son en lugar de ser ignorados.

No tiene componente de tasa de victorias. Los términos basados en resultados premian el juego en escuadra y las cuentas largas más que miden al jugador, así que WNX puntúa solo lo que el jugador hizo en la batalla: daño más asistencia, frags y avistamientos contra lo que se espera que el vehículo produzca.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

El exponente final estira la parte superior de la escala, por lo que la diferencia entre una buena y una cuenta excepcional se mantiene visible en lugar de comprimirse. ```

Los valores esperados provienen de tomato.gg, que los recomputa a partir de una gran muestra de cuentas rastreadas. Esta es la clasificación predeterminada en unicum.gg porque reacciona más rápido a cómo se juega realmente un vehículo hoy en día.
