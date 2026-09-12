---
term: 基于战斗的要塞评级
aliases:
  - SRB
related:
  - sr
  - stronghold
  - advances
  - hr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

基于战斗数量的要塞评级，奖励战斗量而不仅仅是限制，因此一个在数百场战斗中证明自己的家族，排名会高于一个在二十场中拥有相同SR的家族。

SR故意忽略家族的游戏频率。SRB则在同样的评级基础上乘以一个随着战斗数量增长的因子，因此它的值总是高于它所依赖的SR。

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

对数性质，因此前一百场战斗的价值远大于第千场。 ```

每个级别的一个固定量，这是故意设定的：小规模战斗十级是持续进行的，而进攻则是每年几周集中进行，因此真正更多参与的级别会获得更大的奖励。这和钢铁猎人排行榜上的HRB与HR是同样的概念。
