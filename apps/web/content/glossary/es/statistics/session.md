---
term: Sesión
aliases:
  - session stats
  - estadísticas diarias
related:
  - recent-stats
  - battles
  - coverage
---

Un bloque de batallas jugadas en una sola sesión, reconstruido por un rastreador a partir de la diferencia entre dos instantáneas de una cuenta.

La API de Wargaming sirve los totales de una cuenta, no sus batallas individuales. Un rastreador toma instantáneas de esos totales regularmente, y la diferencia entre dos instantáneas es exactamente las batallas jugadas en medio, con su daño, muertes y resultados.

Esa diferencia es una sesión. Es cómo un sitio puede mostrar lo que un jugador hizo hoy en lugar de lo que ha hecho desde 2013, y es sobre lo que se calculan las calificaciones recientes.

Su resolución depende de con qué frecuencia se toma la instantánea de la cuenta, por lo que una sesión es un bloque de juego en lugar de un tiempo de inicio y fin preciso, y una batalla jugada justo antes de una instantánea cae en la sesión de esa instantánea.
