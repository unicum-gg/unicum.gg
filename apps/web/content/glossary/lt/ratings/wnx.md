---
term: WNX
aliases:
  - WNX rating
  - WNX reitingas
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

Šiuolaikinis kiekvienos transporto priemonės reitingas, į žalos dydį įtraukiantis pagalbos žalą ir visiškai atsisakantis pergalės rodiklio.

WNX išlaiko WN8 sandarą, santykius su kiekvienai transporto priemonei apskaičiuotomis tikėtinomis reikšmėmis ir pakeičia skaičiuojamus rodiklius. Žala už vikšrų sugadinimą ir radijo pagalbą prie žalos pridedama įskaičiuojant du trečdalius jos vertės, todėl sąjungininko aptikimas ir vikšrų sugadinimas vertinami kaip tikras žaidėjo indėlis, o ne ignoruojami.

Jame nėra pergalės rodiklio komponento. Rezultatais paremti rodikliai labiau apdovanoja žaidimą būryje ir senas paskyras, nei matuoja žaidėją, todėl WNX vertina tik tai, ką žaidėjas padarė mūšyje: žalą ir pagalbą, sunaikinimus bei aptiktus priešininkus, lyginant su tuo, ką tikimasi atlikti su ta transporto priemone.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Viršutinį skalės galą išplečiantis laipsnio rodiklis užtikrina, kad skirtumas tarp gero ir išskirtinio žaidėjo paskyros išliktų matomas, o ne būtų suspaustas. ```

Tikėtinos reikšmės perskaičiuojamos pagal didelę stebimų paskyrų imtį. Tai yra numatytasis reitingas svetainėje unicum.gg, nes jis greičiausiai reaguoja į tai, kaip transporto priemone iš tikrųjų žaidžiama šiandien.
