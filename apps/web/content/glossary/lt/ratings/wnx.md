---
term: WNX
aliases:
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

WNX yra modernus kiekvieno tanko reitingas, kuris skaičiuoja pagalbos žalą greta padarytos žalos ir visiškai atsisako laimėjimų statistikos.

WNX išlaiko WN8 formą, proporcijas prieš tikėtinas kiekvieno tanko vertes ir keičia tai, ką jis skaičiuoja. Sekimo ir radijo pagalba pridedama prie žalos dviem trečdaliais jų vertės, todėl pagalba sąjungininkui ir pėstininkų blokavimas yra vertinami pagal savo indėlį, o ne ignoruojami.

Jame nėra laimėjimų komponento. Rezultatų pagrindu pagrįsti terminai skatina žaidėjų grupelėse žaisti ir ilgas paskyras labiau nei įvertina pačius žaidėjus, todėl WNX skaičiuoja tik tai, ką žaidėjas padarė mūšyje: žala plius pagalba, frags ir spots prieš tai, ką tankas tikimasi pagaminti.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Pabaigos eksponentas ištempia skalės viršūnę, todėl atotrūkis tarp gero ir išskirtinio paskyros išlieka matomas, o ne suspaustas. ```

Tikėtinos vertės gaunamos iš tomato.gg, kuris jas perskaičiuoja iš didelės sekamos paskyrų imties. Tai yra numatytasis reitingas unicum.gg, nes jis greičiausiai reaguoja į tai, kaip tankas iš tikrųjų žaidžiamas šiandien.
