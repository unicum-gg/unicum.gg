---
term: Session
aliases:
  - session stats
  - denne statistike
related:
  - recent-stats
  - battles
  - coverage
---

Blok bitk, ki so odigrane v eni seji, rekonstruiran od sledi računa iz razlike med dvema posnetkoma računa.

Wargamingova API služi skupnim zneskom računa, ne posameznim bitkam. Sledilnik redno zajema te zneske in razlika med dvema posnetkoma je točno število bitk, odigranih v tem času, z njihovim poškodbam, ubijanjami in rezultati.

Ta razlika je seja. Tako lahko spletna stran pokaže, kaj je igralec naredil danes, namesto kaj je storil od leta 2013, in na osnovi tega se izračunavajo nedavne ocene.

Njena resolucija je odvisna od tega, kako pogosto je račun posnet, zato je seja blok igre bolj kot natančen začetek in konec, in bitka, odigrana takoj pred posnetkom, spada v sejo tega posnetka.
