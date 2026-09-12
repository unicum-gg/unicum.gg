---
term: Session
aliases:
  - session stats
  - napi statisztikák
related:
  - recent-stats
  - battles
  - coverage
---

Egy olyan csatablokk, amelyet egy ülésben játszottak, és egy nyomkövető rekonstruál a két pillanatfelvétel közötti különbségből egy fiókon.

A Wargaming API az egy fiók összesített adatait szolgáltatja, nem az egyes csatáit. Egy nyomkövető rendszeresen készít pillanatfelvételeket ezekről az összesítésekről, és a két pillanatfelvétel közötti különbség pontosan az azon belül játszott csaták, azok sebzése, ölései és eredményei.

Ez a különbség egy session. Ez az, ahogyan egy weboldal meg tudja mutatni, hogy egy játékos mit csinált ma, ahelyett, hogy azt mutatná, hogy mit csinált 2013 óta, és ezen alapulnak a legfrissebb értékelések.

A felbontása attól függ, hogy milyen gyakran készítenek pillanatfelvételt a fiókról, így a session egy játékblokknak tekinthető, nem pedig egy pontos kezdési és befejezési időpontnak, és egy csata, amely közvetlenül egy pillanatfelvétel előtt zajlott, abban a pillanatfelvétel session-jében szerepel.
