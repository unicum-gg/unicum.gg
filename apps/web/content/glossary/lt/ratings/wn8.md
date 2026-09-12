---
term: WN8
aliases:
  - WN8 reitingas
  - wn8 rezultatas
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

Bendruomenės našumo reitingas, kuris vertina žaidėją pagal žalą, nužudymus, pastebėjimus ir bazinę gynybą, kurių tikimasi iš žaidžiamų transporto priemonių, su laimėjimų rodikliu viršuje.

WN8 atsako į klausimą, į kurį žali vidurkiai negali atsakyti. Ar 1,800 žalų per mūšį yra gerai? Ant Tier X sunkiojo tai nėra nieko ypatingo, ant Tier V vidutinio tai yra išskirtinė vertė. WN8 lygina kiekvieną transporto priemonę, esančią sąskaitoje, su serverio vidurkiu už tą pačią transporto priemonę, todėl žaidėjas, kuris daugiausia vairuoja Tier VI, yra vertinamas pagal Tier VI, o ne visą populiaciją.

Jis buvo paskelbtas 2013 metais WN komandos kaip WN7 įpėdinis, kurio lygio bauda leido lengvai manipuliuoti. Penki santykiai prisideda: žala, nužudymai, pastebėjimai, prarasti užėmimo taškai ir laimėjimų rodiklis, kiekvienas padalintas iš tikėtinos vertės už žaidžiamas transporto priemones, minima nulinė verte ir apribojama pagal žalos rodiklį, kad viena stipri ašis negalėtų nešti kitų. 

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Kiekvienas santykis čia yra koreguota forma: žali santykiai, perkeliami pagal jų grindis, apriboti pagal žalos santykį, kurį jie dauginasi. ```

Žala sudaro maždaug tris ketvirčius svorio, kas yra įprasta skundų priežastis: pasyvus žaidėjas, kuris renkasi žalą iš užnugario, gauna geresnį įvertinimą, nei tai nusipelnė. Laimėjimų rodiklis yra apribotas iki 1.8, todėl stiprus platonas negali neribotai išpūsti silpnos sąskaitos.

Kadangi tikėtinos vertės yra serverio akimirka, WN8 kinta, kai populiacija ir transporto priemonės keičiasi. Tankas, kuris buvo patobulintas, pakelia kartelę visiems, kurie jį vairuoja, per kitą duomenų rinkinį. WN8 taip pat yra kumuliatyvus per visą sąskaitos istoriją, todėl keli tūkstančiai ankstyvų mūšių ir toliau turi įtakos jam net po metų, dėl to dauguma žaidėjų stebi savo neseną WN8.
