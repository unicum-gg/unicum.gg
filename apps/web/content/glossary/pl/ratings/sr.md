---
term: Ocena Twierdzy
aliases:
  - SR
  - ocena potyczek
  - ranking potyczek
related:
  - srb
  - elo
  - personal-rating
  - stronghold
  - advances
links:
  - target: stronghold
anchors:
  labels:
    - SR
    - Stronghold Rating
---

Ocena skuteczności w Twierdzy używana na unicum.gg: siła składu pomnożona przez miarę tego, o ile współczynnik zwycięstw klanu przekracza 50%, z obniżeniem wyniku składów korzystających z kont podbijających statystyki.

Wyniki w Twierdzy trudno porównywać, ponieważ klan sam wybiera przeciwników i liczbę bitew. SR odpowiada na węższe pytanie: jak dobry jest ten skład i czy z nim wygrywa.

```formula
SR = roster strength x (win rate / 50%)^1.5 x (1 - boost share)^1.5

Siła składu to mediana nadwyżki Oceny osobistej członków klanu ponad 4,500. Mediana, a nie średnia: pozostaje odporna zarówno na dolny ogon małych kont, jak i na kilku graczy zawyżających wynik. ```

Siła składu jest mierzona powyżej progu rywalizacji, a nie od zera, dlatego różnica między przeciętnym a elitarnym składem jest czynnikiem dominującym. Współczynnik zwycięstw jest neutralny przy 50% i rośnie szybciej niż liniowo, dlatego dominacja jest warta więcej niż nieznaczna przewaga.

Ostatni czynnik zapobiega nabijaniu wyniku. W Twierdzy, a szczególnie w Natarciach, gra się z kontami podbijającymi statystyki: małymi kontami niemal bez bitew losowych, które istnieją wyłącznie po to, by uzupełniać skład Twierdzy. Tego braku aktywności nie da się upozorować, dlatego wynik składu pełnego takich kont jest obniżany.

Liczba bitew w ogóle nie jest uwzględniana, dzięki czemu jest to czysta ocena umiejętności. Minimalny próg bitew nie dopuszcza na tabelę wyników graczy z zaledwie garstką szczęśliwych gier, a SRB jest pokrewnym wskaźnikiem premiującym liczbę bitew.
