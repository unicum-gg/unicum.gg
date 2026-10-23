---
term: Hodnotenie režimu
aliases:
  - MR
  - hodnotenie režimu
related:
  - skirmish
  - win-rate
  - wn8
anchors:
  labels:
    - MR
    - Mode rating
---

Hodnotenie výkonu, ktoré unicum.gg používa pre herné režimy mimo Náhodných bitiek a ktoré vychádza z priemerných skúseností za bitku a miery víťazstiev, pričom obe hodnoty sa porovnávajú s mediánom hráčov daného režimu.

WN7, WN8 a WNX sa tam nedajú použiť. Všetky tri vychádzajú z očakávaného poškodenia nameraného v Náhodných bitkách, takže Šarvátka v Pevnosti sa hodnotí ako bitka v režime Náhodné bitky, ktorú nikto nemohol odohrať: tento režim je kratší a obmedzený úrovňou, preto poškodenie dobrého hráča dosahuje iba zlomok jeho priemeru z Náhodných bitiek, zatiaľ čo jeho miera víťazstiev sa pohybuje okolo 90%. Pri meraní na jednom vozidle dosiahol ten istý hráč 1,794 WNX v Šarvátke oproti 4,708 v Náhodných bitkách, pri 89.5% víťazstiev oproti 71.9%. Správnou odpoveďou nie je upravené WN8, ale iná otázka, ktorú kladie MR: ako si tento hráč vedie v porovnaní s ľuďmi, ktorí hrajú tento režim.

Používa dve osi. Priemerné skúsenosti za bitku sú ukazovateľom efektivity, pretože vlastný vzorec hry na výpočet skúseností už zahŕňa poškodenie, zničenia, odhaľovanie a čas prežitia, takže samostatné osi by tú istú bitku započítali dvakrát. Miera víťazstiev predstavuje výsledok. Každá hodnota sa vydelí vlastným mediánom daného režimu, obe majú rovnakú váhu a člen zohľadňujúci počet bitiek potom znižuje význam malej vzorky, aby sa hráč so stovkou bitiek nemohol umiestniť vyššie než niekto s tisíckami.

Posledné delenie zabezpečuje prenosnosť čísla: skóre sa škáluje podľa vlastného mediánového skóre daného režimu, takže **1000 je mediánový hráč v každom režime**. Bez toho by režimy neboli porovnateľné ani po normalizácii oboch osí, pretože člen zohľadňujúci počet bitiek pracuje s ich počtom a jednotlivé režimy sa hrajú v úplne odlišnom množstve: podľa meraní na EU sa mediánové skóre pohybovalo od 893 v Klanových vojnách VI po 1300 v Šarvátke, čo by pri rovnakom postavení označilo priemerného hráča Šarvátky nazeleno a priemerného hráča inde naoranžovo.

MR si nenárokuje porovnateľnosť s WN8. Tie hodnotia hráča voči celej hráčskej základni, zatiaľ čo MR ho hodnotí voči skupine, ktorá si daný režim sama vybrala, pričom režim priťahujúci silných hráčov má vyššiu latku než režim, ktorý ich nepriťahuje. Ukazuje, aké je vaše postavenie medzi ľuďmi, ktorých tam skutočne stretávate.
