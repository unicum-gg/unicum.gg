---
term: WNX
aliases:
  - WNX reitings
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

Mūsdienīga vērtēšana katram transportlīdzeklim, kas skaita palīgdarbības bojājumus līdzās nodarītajiem bojājumiem un pilnībā izslēdz uzvaru procentu.

WNX saglabā WN8 formu, proporcijas pret katra transportlīdzekļa sagaidāmajām vērtībām un maina to, ko tas skaita. Traucēšanas un radio palīdzība tiek pievienota bojājumiem divu trešdaļu vērtībā, tādējādi atklāšana ally un dzelžus bloķēšana tiek novērtēta kā ieguldījums, kāds tas ir, nevis tiek ignorēts.

Tam nav uzvaru procentu komponentes. Iznākuma balstītie termini atalgo plānošanu un garus kontus vairāk nekā tie novērtē spēlētāju, tāpēc WNX vērtē tikai to, ko spēlētājs izdarīja kaujā: bojājumus plus palīdzību, frags un spots pret to, ko transportlīdzeklis ir gaidīts ražot.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65



``` 

Mūsu sagaidāmās vērtības nāk no tomato.gg, kas tās aprēķina no liela sekojošo kontu parauga. Tas ir noklusējuma reitings uz unicum.gg, jo tas reaģē visstraujāk uz to, kā transportlīdzeklis tiek spēlēts šodien.
