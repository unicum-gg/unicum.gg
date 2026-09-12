---
term: Vaikutus per minuutti
aliases:
  - DPM
  - jatkuva vahinko
related:
  - alpha-damage
  - reload
  - rate-of-fire
  - dpg
anchors:
  specKeys:
    - dpm
  labels:
    - DPM
---

Kuinka paljon ase tuottaa jatkuvassa vaihdossa, alpha kerrottuna sillä kuinka usein se voi ampua.

DPM on jatkuva vastine alphalta. Se kertoo, mitä ase tuottaa, jos se ei koskaan lopeta ampumista, mikä määrittää pitkän taistelun, jossa molemmat ajoneuvot vaihtavat laukauksia avoimella alueella.

```formula
DPM = alpha x 60 / reload

Magasiiniaseella koko sykli lasketaan: klipin vahinko jaettuna ajan kanssa, joka tarvitaan sen ampumiseen ja lataamiseen. ```

Se on katto, ei mittaus. Kukaan ei ammu jäähdytyksellä täyttä minuuttia: tähtääminen, uudelleensijoittaminen ja kohteen odottaminen kaikki leikkaavat siihen, joten ase, jolla on paras DPM paperilla, häviää usein sellaiseen, joka osuu kovemmin per laukaus.

Miehistötaito, varusteet ja kulutustavarat kaikki nostavat sitä, mikä on syy siihen, että luku, joka näytetään vakiokokoonpanolle ja luku, johon täysin varusteltu ajoneuvo pääsee, voi vaihdella viidenneksellä tai enemmän.
