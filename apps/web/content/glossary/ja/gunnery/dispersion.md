---
term: Dispersion
aliases:
  - spread
  - エイミングサークルのサイズ
related:
  - accuracy
  - bloom
  - aim-time
  - aiming-circle
anchors:
  specKeys:
    - dispMoving
    - dispTankTraverse
    - dispTurretTraverse
    - dispAfterShot
    - dispWhileDamaged
  labels:
    - Dispersion
---

エイミングサークルのサイズは、動いているときに拡大し、砲が安定するにつれて縮小します。

Dispersion は精度の背後にあるライブ値です。これは砲の基本値から始まり、現在有効なすべてのペナルティによって乗算されます：運転中、車体を回転させるとき、砲塔を回転させるとき、ダメージを受けるとき、発射するときです。

インターフェースでは、これをレティクルとして表示します。広い円はただの撃ちやすさが悪くなるだけでなく、その中のどこにでも着弾する可能性があるため、経験豊富なプレイヤーはターゲットよりも広い円に撃つのではなく、撃つのを待ちます。
