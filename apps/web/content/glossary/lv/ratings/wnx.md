---
term: WNX
aliases:
  - WNX rating
  - WNX vērtējums
related:
  - wn8
  - expected-values
  - assistance-damage
  - rating-colors
links:
  - target: top-players
anchors:
  labels:
    - WNX
---

Mūsdienīgs katra transportlīdzekļa vērtējums, kas pieskaita palīdzības bojājumus līdzās nodarītajiem bojājumiem un pilnībā izslēdz uzvaru procentu komponenti.

WNX saglabā WN8 struktūru un attiecības pret katram transportlīdzeklim sagaidāmajām vērtībām, taču maina uzskaitāmos rādītājus. Kāpurķēžu un radio palīdzība tiek pieskaitīta bojājumiem divu trešdaļu vērtībā, tāpēc pretinieka pamanīšana sabiedrotā labā un kāpurķēdes bloķēšana tiek novērtēta kā reāls ieguldījums, nevis ignorēta.

Tam nav uzvaru procentu komponentes. Uz iznākumu balstīti rādītāji vairāk atalgo spēlēšanu grupā un ilgstoši uzturētus kontus, nevis mēra spēlētāju, tāpēc WNX vērtē tikai to, ko spēlētājs paveica kaujā: bojājumus un palīdzību, iznīcinātos pretiniekus un atklātos mērķus salīdzinājumā ar to, ko no attiecīgā transportlīdzekļa sagaida.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Eksponents skalas beigās izstiepj tās augšējo daļu, tāpēc atšķirība starp labu un izcilu kontu paliek pamanāma, nevis tiek saspiesta. ```

Sagaidāmās vērtības tiek pārrēķinātas, izmantojot lielu izsekotu kontu izlasi. Tas ir noklusējuma vērtējums vietnē unicum.gg, jo visātrāk reaģē uz to, kā transportlīdzeklis mūsdienās faktiski tiek spēlēts.
