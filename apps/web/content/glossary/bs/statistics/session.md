---
term: Session
aliases:
  - session stats
  - dnevne statistike
related:
  - recent-stats
  - battles
  - coverage
---

Blok bitaka odigranih u jednom sjedenju, rekonstruiran od strane tragača iz razlike između dva snimka računa.

Wargamingov API pruža ukupne podatke računa, a ne njegove pojedinačne bitke. Tragač redovno snima te ukupne podatke, a razlika između dva snimka je tačno ono što su bitke odigrane između, sa njihovim štetama, ubistvima i rezultatima.

Ta razlika je sesija. To je način na koji web stranica može prikazati šta je igrač radio danas umjesto šta je radio od 2013. godine, i to je osnova na kojoj su proračunate nedavne ocjene.

Njegova rezolucija zavisi od toga koliko često je račun sniman, tako da je sesija blok igranja umjesto preciznog vremena početka i završetka, a bitka odigrana neposredno prije snimka ulazi u tu sesiju snimka.
