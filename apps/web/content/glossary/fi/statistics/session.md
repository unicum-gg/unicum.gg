---
term: Istunto
aliases:
  - session stats
  - päivittäiset tilastot
related:
  - recent-stats
  - battles
  - coverage
---

Istunto on joukko taisteluita, jotka on pelattu yhdessä istunnossa, ja jotka tracker on rekonstruoinut kahden tilin otoksen eron perusteella.

Wargamingin API palvelee tilin kokonaislukuja, ei yksittäisiä taisteluita. Tracker ottaa säännöllisesti otoksia näistä kokonaisluvuista, ja kahden otoksen välinen ero on juuri ne taistelut, jotka on pelattu niiden välillä, niiden vahinkojen, tappojen ja tulosten kanssa.

Se ero on istunto. Tämä on se, miten sivusto voi näyttää, mitä pelaaja teki tänään sen sijaan, mitä he ovat tehneet vuodesta 2013 alkaen, ja se on se, mihin käyttötodistuksen tuoreimmat arvioinnit perustuvat.

Sen tarkkuus riippuu siitä, kuinka usein tiliä otetaan otokselle, joten istunto on pelin lohko eikä tarkka alkamis- ja päättymisaika, ja taistelu, joka pelataan juuri ennen otosta, kuuluu kyseisen otoksen istuntoon.
