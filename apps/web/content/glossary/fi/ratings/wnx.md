---
term: WNX
aliases:
  - WNX rating
  - WNX-luokitus
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

Moderni ajoneuvoon perustuva luokitus, joka laskee apuvahinkoja yhdessä aiheutetun vahingon kanssa ja jättää voitto-%:n kokonaan huomioon ottamatta.

WNX säilyttää WN8:n muodon, suhteet ajoneuvokohtaisiin odotusarvoihin ja muuttaa sitä, mitä se laskee. Seuranta- ja radioapua lisätään vahinkoon kahden kolmasosan arvosta, joten liittolaisen paikallistaminen ja telan estäminen lasketaan antamisenä, jota ne ovat, sen sijaan että niitä ignoroitaisiin.

Siinä ei ole voitto-%:n komponenttia. Tulokseen perustuvat termit palkitsevat platoonit ja pitkiä tilejä enemmän kuin mittaavat pelaajaa, joten WNX laskee vain sen, mitä pelaaja teki taistelussa: vahinkoa plus apua, frageja ja paikannuksia verrattuna siihen, mitä ajoneuvon odotetaan tuottavan.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Häntä eksponentti venyttää mittausasteikon yläosaa, joten hyvän ja erinomaisen tilin välinen ero pysyy näkyvissä sen sijaan että se puristuisi. ```

Odotusarvot tulevat tomato.gg:stä, joka laskee ne uudelleen suuresta otoksesta seurattuja tilejä. Tämä on oletusluokitus unicum.gg:ssä, koska se reagoi nopeimmin siihen, miten ajoneuvoa pelataan nykyisin.
