---
term: Session
aliases:
  - statistiques de session
  - stats de session
  - statistiques quotidiennes
  - stats quotidiennes
related:
  - recent-stats
  - battles
  - coverage
---

Un ensemble de batailles jouées d'une traite, reconstitué par un outil de suivi à partir de la différence entre deux instantanés d'un compte.

L'API de Wargaming fournit les totaux d'un compte, et non ses batailles individuelles. Un outil de suivi enregistre régulièrement des instantanés de ces totaux, et la différence entre deux instantanés correspond exactement aux batailles jouées entre les deux, avec leurs dégâts, leurs destructions et leurs résultats.

Cette différence constitue une session. C'est ainsi qu'un site peut montrer ce qu'un joueur a fait aujourd'hui plutôt que tout ce qu'il a accompli depuis 2013, et c'est sur cette base que les évaluations récentes sont calculées.

Sa précision dépend de la fréquence à laquelle des instantanés du compte sont enregistrés, donc une session représente un ensemble de parties plutôt qu'une heure précise de début et de fin, et une bataille jouée juste avant un instantané est rattachée à la session de cet instantané.
