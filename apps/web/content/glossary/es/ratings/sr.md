---
term: Stronghold Rating
aliases:
  - SR
  - calificación de escaramuza
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

La calificación de rendimiento en Stronghold utilizada en unicum.gg: fuerza de la lista multiplicada por cuánto un clan gana por encima del nivel promedio, con listas fortalecidas descontadas.

Los resultados de Stronghold son difíciles de comparar porque un clan elige su oposición y su volumen. SR responde a una pregunta más específica: ¿qué tan buena es esta lista y gana con ella?

```formula
SR = fuerza de la lista x (tasa de victorias / 50%)^1.5 x (1 - participación de refuerzo)^1.5

La fuerza de la lista es la calificación personal mediana del clan por encima de 4,500. La mediana, no la media: descarta tanto la cola baja de cuentas pequeñas como un par de carries. ```

La fuerza de la lista se mide sobre un umbral competitivo en lugar de desde cero, por lo que la brecha entre una lista promedio y una de élite es el término dominante. El factor de victoria es neutral al 50% y super-lineal, por lo que dominar vale más que ganar de forma ajustada.

El último término es el anti-farming. Los Strongholds, especialmente los Avances, se juegan con cuentas de refuerzo: cuentas pequeñas con casi ninguna batalla aleatoria que existen solo para llenar una lista de Stronghold. Esa ausencia no se puede simular, por lo que una lista llena de ellas se reduce en escala.

El volumen no está presente en absoluto, lo que lo convierte en una calificación puramente de habilidad. Un umbral de batalla mantiene un puñado afortunado de juegos fuera de la tabla de clasificación, y SRB es el hermano que recompensa el volumen.
