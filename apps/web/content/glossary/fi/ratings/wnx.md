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

Nykyaikainen ajoneuvokohtainen luokitus, joka laskee avustusvahingon aiheutetun vahingon rinnalle ja jättää voittoprosenttiosuuden kokonaan pois.

WNX säilyttää WN8:n rakenteen ja ajoneuvokohtaisten odotusarvojen vastaiset suhteet, mutta muuttaa sitä, mitä se laskee. Telaketju- ja radioavustus lisätään vahinkoon kahdella kolmasosalla niiden arvosta, joten vihollisten havaitseminen liittolaisen hyväksi ja telaketjun pysäyttäminen pisteytetään niiden todellisena panoksena sen sijaan, että ne jätettäisiin huomiotta.

Siinä ei ole voittoprosenttikomponenttia. Tulokseen perustuvat termit palkitsevat ryhmässä pelaamista ja pitkiä pelitilejä enemmän kuin mittaavat pelaajaa, joten WNX pisteyttää vain sen, mitä pelaaja teki taistelussa: vahinkoa sekä avustusvahinkoa, tuhoamisia ja havaintoja verrattuna siihen, mitä ajoneuvon odotetaan tuottavan.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Skaalan loppupään eksponentti venyttää asteikon yläpäätä, joten hyvän ja poikkeuksellisen pelitilin välinen ero säilyy näkyvänä sen sijaan, että se kutistuisi. ```

Odotusarvot lasketaan uudelleen suuren seuratuista pelitileistä koostuvan otoksen perusteella. Tämä on unicum.gg:n oletusluokitus, koska se reagoi nopeimmin siihen, miten ajoneuvoa todellisuudessa pelataan nykyään.
