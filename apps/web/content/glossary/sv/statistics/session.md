---
term: Session
aliases:
  - session stats
  - dagliga stats
related:
  - recent-stats
  - battles
  - coverage
---

Ett block av strider som spelas under en sittning, rekonstruerat av en tracker från skillnaden mellan två ögonblicksbilder av ett konto.

Wargamings API visar ett konto totalsummor, inte dess individuella strider. En tracker tar regelbundet ögonblicksbilder av dessa totalsummor, och skillnaden mellan två ögonblicksbilder är exakt striderna som spelats mellan, med deras skador, döda och resultat.

Den skillnaden är en session. Det är hur en webbplats kan visa vad en spelare gjorde idag snarare än vad de har gjort sedan 2013, och det är vad nyliga bedömningar beräknas över.

Dess upplösning beror på hur ofta kontot snapshottas, så en session är ett block av spel snarare än en exakt start- och sluttid, och en strid som spelas precis innan en ögonblicksbild hamnar i den ögonblicksbildens session.
