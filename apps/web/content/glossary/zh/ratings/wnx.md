---
term: WNX
aliases:
  - WNX rating
  - WNX 评分
  - WNX评级
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

一种按战车统计的现代评分，将协助伤害与造成的伤害一并计入，并完全取消胜率项。

WNX 保留 WN8 的结构和与每辆战车预期值进行比较的比率，但改变了统计内容。履带协助和通信协助会按其数值的三分之二计入伤害，因此为队友提供侦察和阻断敌方履带都会按照实际贡献计分，而不是被忽略。

它不包含胜率项。基于结果的指标会更多地奖励组队和战斗场次多的账号，而不是衡量玩家本人，因此 WNX 只计算玩家在战斗中的表现：伤害加协助、击杀和侦察，并与该战车的预期表现进行比较。

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

尾部指数会拉伸量表的高端，因此优秀账号与卓越账号之间的差距仍然清晰可见，而不会被压缩。 ```

预期值会根据大量受追踪账号的数据重新计算。这是 unicum.gg 上的默认评分，因为它对战车当前实际玩法的变化反应最快。
