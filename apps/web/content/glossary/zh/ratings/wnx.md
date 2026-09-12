---
term: WNX
aliases:
  - WNX评分
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

WNX是一个现代的每辆车评分，它在计算破坏时同时涵盖辅助伤害，完全不考虑胜率的因素。

WNX保持WN8的结构，按照每辆车的预期值计算比率，并改变所计入的内容。跟踪和无线电辅助的价值以三分之二计入伤害，因此为友军探测和阻挡轨道的贡献将被记录，而不是被忽视。

它没有胜率组成部分。基于结果的术语在一定程度上奖励分队和长期账户，而不是衡量玩家，因此WNX仅计算玩家在战斗中的表现：伤害加上辅助，杀敌和探测与车辆的预期产出进行对比。

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT，然后 raw x (raw / 1000) ^ 0.45 x 1.65

尾部指数拉伸了刻度的上部分，所以优秀和卓越账户之间的差距仍然可见，而不是被压缩。 ```

预期值来自tomato.gg，它根据大量跟踪账户的样本进行重新计算。这是在unicum.gg上的默认评分，因为它最能迅速反映车辆今天的实际表现。
