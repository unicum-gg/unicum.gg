---
term: WN8
aliases:
  - WN8 rating
  - wn8 score
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

Ocjena performansi zajednice koja boduje igrača prema šteti, ubistvima, otkrivanju i osnovnoj odbrani koje se očekuju od vozila koja zapravo igraju, sa terminom o stopi pobjeda na vrhu.

WN8 odgovara na pitanje na koje sirovi prosjek ne može. Da li je 1,800 štete po bitci dobro? Na Tier X teškom je to prosječno, na Tier V srednjem je to izvanredno. WN8 uspoređuje svako vozilo na računu s prosjekom na serveru za to isto vozilo, tako da se igrač koji uglavnom vozi Tier VI mjeri protiv Tier VI umjesto protiv cjelokupne populacije.

Objavljen je 2013. od strane WN tima kao nasljednik WN7, čija je kazna za tier olakšala manipulaciju. Pet omjera ga čini: šteta, ubistva, otkrivanje, kaputni bodovi i stopa pobjeda, svaki podijeljen s očekivanom vrijednošću za vozila koja se igraju, srušeno na nulu i ograničeno prema terminu štete tako da jedan jak faktor ne može nositi ostatak.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Svaki omjer ovdje je ispravljena forma: sirovi omjer pomjeren prema svom dnu, ograničen na omjer štete koji multiplicira. ```

Šteta nosi otprilike tri četvrtine težine, što je uobičajena pritužba na to: pasivni igrač koji skuplja štetu sa pozadine boduje bolje nego što brojevi zaslužuju. Termin o stopi pobjeda je ograničen na 1.8 tako da snažan vod ne može neograničeno inflirati slab račun.

Budući da su očekivane vrijednosti trenutni prikaz servera, WN8 se pomiče kako populacija i vozila mijenjaju. Tenek koji se pojačava podiže ljestvicu za sve koji ga voze prilikom sljedeće ažuriranja skupa podataka. WN8 je također kumulativan kroz cijelu historiju računa, tako da nekoliko tisuća ranih bitaka i dalje utječe na njega godinama kasnije, zbog čega većina igrača gleda svoj nedavni WN8 umjesto toga.
