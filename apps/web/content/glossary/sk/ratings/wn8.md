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

Ocena zmogljivosti skupnosti, ki oceni igralca glede na škodo, ubijanja, opazovanje in obrambne točke, ki se pričakujejo od vozil, ki jih dejansko igra, z višjo stopnjo zmag.

WN8 odgovarja na vprašanje, na katerega surova povprečja ne morejo odgovoriti. Je 1,800 škode na bitko dobra? Pri Tier X težkem vozilu je to neznačilno, pri Tier V srednjem vozilu pa je to izjemno. WN8 primerja vsako vozilo na računu z povprečjem strežnika za to isto vozilo, tako da se igralec, ki večinoma vozi Tier VI, meri v primerjavi s Tier VI namesto s celotno populacijo.

Objavili so ga leta 2013 ekipa WN kot naslednika WN7, katere kazen za tier je omogočila manipulacijo. Pet razmerij ga napaja: škoda, ubijanja, opazovanja, odvržene točke zajema in stopnja zmag, vsako razdeljeno na pričakovano vrednost za igrana vozila, pri čemer je spodnja meja na nič in zgornja meja na škodo, tako da en močan faktor ne more prevzeti ostalih.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Vsako razmerje tukaj je popravljena oblika: surovo razmerje, premaknjeno za njegovo dno, omejeno na razmerje, ki ga množi. ```

Škoda nosi približno tri četrtine teže, kar je običajna pritožba glede tega: pasivni igralec, ki nabira škodo zadaj, dobi višjo oceno, kot si zasluži. Stopnja zmag je omejena na 1.8, tako da močan polk ne more neskončno napihovati šibkega računa.

Ker so pričakovane vrednosti posnetek strežnika, se WN8 spreminja, ko se populacija in vozila spreminjajo. Tank, ki je bil izboljšan, dvigne prag za vse, ki ga vozijo, ob naslednji posodobitvi podatkov. WN8 je prav tako kumulativna čez celotno zgodovino računa, zato nekatere tisoč zgodnjih bitk še naprej vplivajo nanj leta kasneje, kar je razlog, zakaj večina igralcev spremlja svoj nedavni WN8 namesto tega.
