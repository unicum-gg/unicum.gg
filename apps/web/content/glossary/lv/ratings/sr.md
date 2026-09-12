---
term: Stronghold Rating
aliases:
  - SR
  - skirmish rating
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

Stronghold sasniegumu vērtējums, kas izmantots vietnē unicum.gg: sastāva spēks reizināts ar to, cik tālu virs vidējā klans uzvar, ņemot vērā papildināto sastāvu.

Stronghold rezultāti ir grūti salīdzināmi, jo klans izvēlas savu pretinieku un tā apjomu. SR atbild uz šaurāku jautājumu: cik labs ir šis sastāvs un vai tas uzvar ar to.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Roster strength ir vidējais Personālais Vērtējums klanam virs 4,500. Vidējais, nevis aritmētiskais: tas neņem vērā ne mazus kontus, ne dažus izcilniekus. ```

Roster strength tiek mērīts virs konkurences grīdas, nevis no nulles, tāpēc atšķirība starp vidusmēra sastāvu un elitāro ir dominējošais termins. Uzvaras faktors ir neitrāls pie 50% un superlineārs, tāpēc dominēšana ir vērtīgāka par mazu uzvaru.

Pēdējais termins ir pretī lauksaimniecībām. Strongholds, īpaši Advances, tiek spēlēti ar papildinājuma kontiem: maziem kontiem, kuriem gandrīz nav nejaušo cīņu un kuri eksistē tikai, lai aizpildītu stronghold sastāvu. Šī trūkuma nevar simulēt, tāpēc sastāvs, kas pilns ar tiem, tiek samazināts.

Apjoms nav iekļauts vispār, kas to padara par tīru prasmju vērtējumu. Cīņas grīda neļauj laimīgai spēļu grupai iekļūt līderu sarakstā, un SRB ir brālis, kas atlīdzina apjomu.
