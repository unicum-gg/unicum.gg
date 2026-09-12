---
term: WN8
aliases:
  - WN8 rating
  - puntuación wn8
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

Una clasificación de rendimiento de la comunidad que evalúa a un jugador en función del daño, asesinatos, detección y defensa base que se espera de los vehículos que realmente juega, con un término de tasa de victorias adicional.

El WN8 responde a una pregunta que un promedio bruto no puede. ¿Es 1,800 de daño por batalla bueno? En un pesado de Tier X es insignificante, en un medio de Tier V es excepcional. WN8 compara cada vehículo en una cuenta contra el promedio del servidor para ese mismo vehículo, por lo que un jugador que conduce principalmente Tier VI se mide contra Tier VI en lugar de contra toda la población.

Fue publicado en 2013 por el equipo WN como el sucesor del WN7, cuya penalización de tiers lo hacía fácil de manipular. Cinco ratios alimentan: daño, frags, detección, puntos de captura perdidos y tasa de victorias, cada uno dividido por el valor esperado para los vehículos jugados, redondeado a cero y limitado en relación con el término de daño de modo que un solo eje fuerte no pueda arrastrar al resto.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Cada ratio aquí es la forma corregida: el ratio bruto ajustado por su mínimo, limitado al ratio de daño que multiplica. ```

El daño lleva aproximadamente tres cuartas partes del peso, que es la queja habitual al respecto: un jugador pasivo que acumula daño desde la retaguardia puntúa mejor de lo que los números merecen. El término de tasa de victorias está limitado a 1.8, por lo que un fuerte pelotón no puede inflar indefinidamente una cuenta débil.

Debido a que los valores esperados son una instantánea del servidor, el WN8 cambia a medida que la población y los vehículos cambian. Un tanque que recibe mejoras eleva el estándar para todos los que lo manejan en la siguiente actualización de datos. El WN8 también es acumulativo a lo largo de toda la historia de una cuenta, por lo que unas pocas miles de batallas tempranas continúan pesando sobre él años después, razón por la cual la mayoría de los jugadores observan su WN8 reciente en su lugar.
