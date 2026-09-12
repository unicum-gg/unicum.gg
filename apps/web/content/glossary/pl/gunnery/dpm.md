---
term: Uszkodzenia na minutę
aliases:
  - DPM
  - ciągłe uszkodzenia
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

Ile uszkodzeń działo zadaje podczas dłuższej wymiany ognia, czyli alfa pomnożona przez częstotliwość prowadzenia ognia.

DPM jest odpowiednikiem alfy w długotrwałej wymianie ognia. Określa, ile uszkodzeń może zadać działo, jeśli strzela bez przerwy, co rozstrzyga długie starcia, podczas których oba pojazdy wymieniają ogień na otwartym terenie.

```formula
DPM = alpha x 60 / reload

W przypadku działa magazynkowego liczy się cały cykl: uszkodzenia magazynka podzielone przez czas potrzebny na jego wystrzelenie i przeładowanie. ```

Jest to wartość maksymalna, a nie wynik pomiaru. Nikt nie strzela natychmiast po przeładowaniu przez pełną minutę. Celowanie, zmiana pozycji i czekanie na cel obniżają tę wartość, dlatego działo z najlepszym DPM na papierze często przegrywa z takim, które zadaje większe uszkodzenia jednym strzałem.

Umiejętności załogi, wyposażenie i materiały eksploatacyjne zwiększają DPM, dlatego wartość podana dla konfiguracji podstawowej może różnić się od wartości osiąganej przez w pełni wyposażony pojazd o jedną piątą lub więcej.
