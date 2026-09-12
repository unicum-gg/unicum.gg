---
term: Poškození za minutu
aliases:
  - DPM
  - trvalé poškození
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

Kolik poškození dělo způsobí během souvislé přestřelky, tedy alfa poškození vynásobené četností střelby.

DPM je protějškem alfa poškození při souvislé palbě. Udává, kolik poškození dělo způsobí, pokud nikdy nepřestane střílet, což rozhoduje v dlouhé přestřelce, při které po sobě obě vozidla pálí na otevřeném prostranství.

```formula
DPM = alpha x 60 / reload

U zásobníkového děla se počítá celý cyklus: poškození zásobníku vydělené časem potřebným k jeho vystřílení a opětovnému nabití. ```

Je to maximální možná hodnota, nikoli skutečné měření. Nikdo nestřílí ihned po nabití celou minutu: míření, změna pozice a čekání na cíl tuto hodnotu snižují, takže dělo s nejlepším DPM na papíře často prohraje s dělem, které způsobí větší poškození na výstřel.

Schopnosti posádky, vybavení a spotřební doplňky tuto hodnotu zvyšují, proto se údaj uváděný pro základní konfiguraci může od hodnoty plně vybaveného vozidla lišit o pětinu nebo více.
