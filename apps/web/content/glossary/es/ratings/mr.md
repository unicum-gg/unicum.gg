---
term: Valoración del modo
aliases:
  - MR
  - puntuación del modo
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

La valoración del rendimiento que unicum.gg utiliza para los modos de batalla distintos de Batallas Aleatorias, calculada a partir de la experiencia media por batalla y el porcentaje de victorias, cada uno comparado con la mediana de quienes juegan ese modo.

WN7, WN8 y WNX no pueden utilizarse allí. Los tres se basan en una cifra de daño esperado medida en Batallas Aleatorias, por lo que una Escaramuza de Fortaleza se puntúa como si fuera una Batalla Aleatoria que nadie podría haber jugado: el modo dura menos y está limitado por nivel, lo que reduce el daño de un buen jugador a una fracción de su media en Batallas Aleatorias mientras su porcentaje de victorias se acerca al 90%. Medido en un vehículo, el mismo jugador obtuvo 1,794 WNX en Escaramuza frente a 4,708 en Batallas Aleatorias, con un 89.5% de victorias frente a un 71.9%. La respuesta honesta no es un WN8 corregido, sino una pregunta distinta, y MR la plantea: cómo se compara este jugador con quienes juegan este modo.

Utiliza dos ejes. La experiencia media por batalla es el indicador de efectividad, porque la propia fórmula de experiencia del juego ya incluye el daño, las bajas, la detección y el tiempo de supervivencia, por lo que usar ejes separados contabilizaría dos veces la misma batalla. El porcentaje de victorias es el resultado. Cada uno se divide por la mediana del propio modo, ambos tienen la misma ponderación y, después, un factor de volumen reduce el peso de una muestra pequeña para que cien batallas no puedan colocar a alguien por encima de otro jugador con miles de ellas.

Una última división es lo que permite comparar el número entre modos: la puntuación se escala según la puntuación mediana del propio modo, por lo que **1000 representa al jugador mediano en todos los modos**. Sin ella, los modos no serían comparables ni siquiera después de normalizar los dos ejes, porque el factor de volumen utiliza una cantidad de batallas y los distintos modos se juegan en volúmenes muy diferentes: según las mediciones en EU, la puntuación mediana iba desde 893 en Guerras de clanes VI hasta 1300 en Escaramuza, lo que mostraría en verde a un jugador medio de Escaramuza y en naranja a un jugador medio de cualquier otro modo pese a ocupar la misma posición relativa.

Lo que MR no pretende ofrecer es una comparación con WN8. Esas valoraciones comparan a un jugador con toda la base de jugadores, mientras que MR lo compara con un grupo autoseleccionado, y un modo que atrae a jugadores fuertes tiene un listón más alto que otro que no lo hace. Indica qué posición ocupas entre las personas con las que realmente te encuentras allí.
