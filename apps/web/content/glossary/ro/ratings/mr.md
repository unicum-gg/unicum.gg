---
term: Evaluarea modului
aliases:
  - MR
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

Evaluarea performanței folosită de unicum.gg pentru modurile de luptă din afara Bătăliilor aleatorii, calculată pe baza experienței medii per bătălie și a ratei de victorii, fiecare raportată la mediana jucătorilor acelui mod.

WN7, WN8 și WNX nu pot fi folosite acolo. Toate trei sunt construite în raport cu o valoare a daunelor estimate, măsurată în Bătălii aleatorii, astfel că un Raid din Fortăreață este evaluat ca o bătălie aleatorie pe care nimeni nu ar fi putut-o juca: modul este mai scurt și limitat ca nivel, ceea ce reduce daunele unui jucător bun la o fracțiune din media sa aleatorie, în timp ce rata sa de victorii rămâne aproape de 90%. Măsurat pe un singur vehicul, același jucător a obținut 1,794 WNX în Raid, față de 4,708 în Bătălii aleatorii, cu 89.5% victorii față de 71.9%. Răspunsul corect nu este un WN8 ajustat, ci o întrebare diferită, iar MR o pune: cum se compară acest jucător cu cei care joacă acest mod.

Folosește două axe. Experiența medie per bătălie este indicatorul eficienței, deoarece formula de experiență a jocului include deja daunele, eliminările, detectarea și timpul de supraviețuire, astfel că axe separate ar lua în calcul aceeași bătălie de două ori. Rata de victorii reprezintă rezultatul. Fiecare este împărțită la mediana proprie a modului, ambele au ponderi egale, iar apoi un termen de volum reduce impactul unui eșantion mic, astfel încât o sută de bătălii să nu poată plasa pe cineva în fruntea clasamentului înaintea unui jucător cu mii de bătălii.

O ultimă împărțire face ca numărul să fie comparabil între moduri: scorul este scalat folosind scorul median propriu al modului, astfel că **1000 reprezintă jucătorul median în fiecare mod**. Fără aceasta, modurile nu ar fi comparabile nici după normalizarea celor două axe, deoarece termenul de volum folosește numărul de bătălii, iar modurile sunt jucate în volume extrem de diferite: măsurat pe EU, scorul median a variat de la 893 în Războaie între clanuri VI la 1300 în Raid, ceea ce ar colora în verde un jucător mediu de Raid și în portocaliu un jucător mediu din alt mod, pentru aceeași poziție relativă.

MR nu pretinde că oferă o comparație cu WN8. Acestea evaluează un jucător în raport cu întreaga bază de jucători, în timp ce MR îl evaluează în raport cu un grup autoselectat, iar un mod care atrage jucători puternici are un prag mai ridicat decât unul care nu îi atrage. Arată unde te situezi printre jucătorii pe care îi întâlnești efectiv acolo.
