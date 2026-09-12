---
term: Battles-based Stronghold Rating
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

戦闘回数に基づく強固な評価で、単に制限されるのではなく、報酬が与えられるため、数百回の戦闘で実績を示したクランが、同じSRを持つ20回の戦闘のクランよりも上位にランクされる。

SRはクランがどれだけプレイしているかを意図的に無視する。SRBはその同じ評価を取り、後ろにある戦闘に応じて成長する項で掛け算をするため、常に基盤となるSRよりも高くなることしかできない。

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

ログarithmicなので、最初の100回の戦闘は千回目のものよりもはるかに価値がある。 ```

すべてのティアにわたって一貫したボリュームが意図されている：スカーミッシュティアXは継続的にプレイされる一方、アドバンスは年に数週間のみ集中して行われるため、実際により多くプレイされるティアはより大きなボーナスを得る。これは、スチールハンターのボードでHRの隣にあるHRBと同じ考え方である。
