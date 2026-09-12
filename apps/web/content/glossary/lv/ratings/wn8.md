---
term: WN8
aliases:
  - WN8 vērtējums
  - wn8 rādītājs
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

Kopienas snieguma vērtējums, kas izvērtē spēlētāju, salīdzinot ar bojājumiem, nogalināšanām, novērošanu un bāzes aizsardzību, kas tiek gaidīta no tiem transportlīdzekļiem, ar kuriem viņi patiesībā spēlē, pievienojot uzvaru procentu.

WN8 atbild uz jautājumu, ko neizdodas atrisināt neapstrādātajam vidējam rādītājam. Vai 1,800 bojājumi cīņā ir labi? Tier X smagajā tas ir neizteiksmīgi, bet Tier V vidējā tas ir izcili. WN8 salīdzina katru transportlīdzekli kontā ar servera vidējo rādītāju tajā pašā transportlīdzeklī, tāpēc spēlētājs, kurš galvenokārt spēlē Tier VI, tiek vērtēts pret Tier VI, nevis pret visu populāciju.

Tā tika publicēta 2013. gadā WN komandas kā WN7 pēctece, kuras līmeņa sods padarīja to viegli manipulējamu. Pieci rādītāji to baro: bojājumi, nogalināšanas, novērošana, pamestie ieņemšanas punkti un uzvaru procents, katrs dalīts ar gaidīto vērtību spēlētajiem transportlīdzekļiem, nolaižot līdz nullei un ierobežojot pret bojājumu rādītāju, lai viens spēcīgs ass nevarētu nesāt pārējos.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Katrs rādītājs šeit ir labotā forma: neapstrādātais rādītājs, kas pārvietots uz leju, ierobežots pret bojājumu rādītāju, ar kuru tas reizinās. ```

Bojājumi nes apmēram trīs ceturtdaļas svara, kas ir parasti sūdzība par to: pasīvs spēlētājs, kurš no aizmugures iegūst bojājumus, iegūst labākus rezultātus, nekā cipari to pelnītu. Uzvaru procents ir ierobežots līdz 1.8, lai spēcīgs plutons nevarētu nepamatoti uzpūst vāju kontu.

Tā kā gaidītās vērtības ir servera snapshot, WN8 mainās, kad populācija un transportlīdzekļi mainās. Tankam, kas tiek uzlabots, palielinās latiņa visiem, kas to brauc pie nākamā datu komplekta atjauninājuma. WN8 ir arī kumulatīvs visā konta vēsturē, tāpēc daži tūkstoši agrīnā cīņā turpina ietekmēt to gadiem vēlāk, kas ir iemesls, kāpēc vairums spēlētāju rūpējas par savu neseno WN8.
