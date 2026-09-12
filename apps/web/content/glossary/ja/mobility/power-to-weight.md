---
term: パワー対重量
aliases:
  - hp/t
  - パワー対重量比
  - p/w
related:
  - engine-power
  - weight
  - terrain-resistance
  - acceleration
anchors:
  specKeys:
    - powerWeight
  labels:
    - Power/weight
    - Power to weight
---

エンジンの馬力を車両の重量（トン単位）で割った値で、加速の最も優れた予測因子です。

パワー対重量は車両の反応性を決定します。おおよそトンあたり20馬力を超えると車両は素早く加速しますが、10未満ではすべてのコーナーと坂道で苦労します。

```formula
power-to-weight = engine horsepower / weight in tonnes

この数値は、構成された車両のために引用されており、装備や重い砲が両方とも影響を与えます。 ```

全ての要素ではありません。地形の抵抗も影響するため、同じ比率の2つの車両は、一方が柔らかい地面を越えるように設計されている場合、非常に異なった動きになります。
