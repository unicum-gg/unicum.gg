---
term: WN8
aliases:
  - WN8 rating
  - rezultat wn8
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

Ocjena izvedbe zajednice koja ocjenjuje igrača prema šteti, ubijenim neprijateljima, otkrivanju i obrani baze koju bi trebali postići s vozilima koja zapravo voze, uz dodatak postotka pobjeda.

WN8 odgovara na pitanje na koje siromašna prosječna ocjena ne može odgovoriti. Je li 1,800 štete po borbi dobro? Na teškom Tier X to je neprimjetno, dok je na srednjem Tier V to izvanredno. WN8 uspoređuje svako vozilo na računu s prosjekom poslužitelja za to isto vozilo, tako da se igrač koji većinom vozi Tier VI mjeri prema Tier VI umjesto prema cijeloj populaciji.

Objavljen je 2013. od strane WN tima kao nasljednik WN7, čija je kazna za tier olakšavala manipulaciju. Pet omjera ga hrani: šteta, fragovi, otkriće, izgubljene kaptažne točke i postotak pobjeda, svaka podijeljena očekivanom vrijednošću za igrana vozila, s maksimumom na nuli i ograničenjem prema kategoriji štete tako da jedan jak kriterij ne može nositi ostale.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Svaki omjer ovdje je ispravljena forma: sirovi omjer pomaknut prema dnu, ograničen na omjer štete koji multiplira. ```

Šteta nosi otprilike tri četvrtine težine, što je uobičajena pritužba: pasivni igrač koji skuplja štetu s leđa dobije bolju ocjenu nego što brojke zaslužuju. Postotak pobjeda je ograničen na 1.8 tako da jak platoon ne može neograničeno napuhati slab račun.

Budući da su očekivane vrijednosti trenutna slika poslužitelja, WN8 varira dok se populacija i vozila mijenjaju. Tenk koji se poboljša podiže standard za sve koji ga voze pri sljedećem ažuriranju podataka. WN8 je također kumulativan kroz cijelu povijest računa, stoga nekoliko tisuća ranih borbi ostaje relevantnih godinama kasnije, zbog čega većina igrača prati svoj nedavni WN8 umjesto toga.
