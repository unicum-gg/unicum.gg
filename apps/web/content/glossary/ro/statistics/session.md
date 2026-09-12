---
term: Session
aliases:
  - session stats
  - statistici zilnice
related:
  - recent-stats
  - battles
  - coverage
---

Un grup de bătălii jucate într-o singură ședință, reconstruit de un tracker din diferența între două instantanee ale unui cont.

API-ul Wargaming oferă totalurile contului, nu bătăliile individuale. Un tracker face instantanee ale acestor totaluri în mod regulat, iar diferența dintre două instantanee este exact bătăliile jucate între ele, împreună cu daunele, uciderile și rezultatele acestora.

Această diferență este o sesiune. Aceasta este modul în care un site poate arăta ce a făcut un jucător astăzi, mai degrabă decât ce a făcut din 2013 și este ceea ce se calculează asupra ratingurilor recente.

Rezoluția acesteia depinde de cât de des este snapshotat contul, așa că o sesiune este un bloc de joc mai degrabă decât un timp precis de început și sfârșit iar o bătălie jucată imediat înainte de o instantanee va face parte din sesiunea acelei instantanee.
