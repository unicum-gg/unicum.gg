---
term: Couverture
aliases:
  - comptes suivis
  - couverture du suivi
related:
  - session
  - expected-values
links:
  - target: coverage
---

La part de la base de joueurs d'un serveur qu'un site de statistiques suit réellement, ainsi que la date de la dernière mise à jour de ces comptes.

Aucun site de suivi ne recense tous les comptes. L'API de Wargaming impose une limite de requêtes, un site découvre donc les comptes grâce aux listes de membres des clans et aux recherches, puis actualise chacun d'eux à une fréquence compatible avec ses ressources. La couverture correspond à la part des joueurs actifs de la région qu'il recense et à la date de la dernière mise à jour de chacun.

C'est important, car chaque classement et chaque moyenne du serveur sont calculés à partir de la population suivie, et non de l'ensemble du serveur. Une couverture étendue rend ces chiffres représentatifs, tandis qu'une couverture limitée n'en fait qu'un échantillon.
