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

Yhteisön suorituskykytaso, joka arvioi pelaajaa vastaan niiden vaurioiden, tappojen, havainnoinnin ja peruspuolustuksen, joita heiltä odotetaan pelaamaan ajamiensa ajoneuvojen osalta, voittoprosentin lisäksi.

WN8 vastaa kysymykseen, johon pelkkä keskiarvo ei pysty. Onko 1,800 vauriota per taistelu hyvä? Tier X raskaalle se on huomaamaton, Tier V keskiraskaalle se on poikkeuksellinen. WN8 vertaa jokaista ajoneuvoa tiliä vastaan sen ajoneuvon palvelinensisäiseen keskiarvoon, joten pelaajaa, joka pääasiassa ajaa Tier VI:ta, mitataan Tier VI:n mukaan sen sijaan, että häntä verrattaisiin koko väestöön.

Se julkaistiin vuonna 2013 WN-tiimin toimesta WN7:n seuraajana, jonka tier-raportointirangaistus teki sen helposti pelattavaksi. Viisi suhdetta syöttää sen: vauriot, tappot, havainnot, pudotetut vallankäyttö-pisteet ja voittoprosentti, jokainen jaettuna pelattujen ajoneuvojen odotettuihin arvoihin, minimissään nollaan ja rajattuna vaurio-suhteeseen, jotta yksi vahva akseli ei voi kantaa loput.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Jokainen suhde tässä on korjattu muoto: raaka suhde siirrettynä lattiarajalleen, rajoitettuna siihen vaurio-suhteeseen, jota se kertoo. ```

Vauriot vaikuttavat noin kolme neljäsosaa painosta, mikä on tavallinen valitus siitä: passiivinen pelaaja, joka kerää vaurioita taistelun takarivistä, saa paremmat pisteet kuin numerot ansaitsisivat. Voittoprosentti on rajattu 1.8:aan, jotta vahva platooni ei voi nostaa heikkoa tiliä rajattomasti.

Koska odotetut arvot ovat paikallistettu otos palvelimesta, WN8 vaihtelee väestön ja ajoneuvojen muuttuessa. Tankki, joka saa parannuksia, nostaa riman jokaiselle, joka ajaa sitä seuraavassa datan päivityksessä. WN8 on myös kertynyt koko tilin historian ajan, joten muutama tuhat aikaisempaa taistelua vaikuttaa siihen vielä vuosien päästä, minkä vuoksi useimmat pelaajat seuraavat nykyistä WN8:aa sen sijaan.
