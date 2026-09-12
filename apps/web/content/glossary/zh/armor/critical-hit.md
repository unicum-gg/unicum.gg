---
term: Critical hit
aliases:
  - crit
  - 致命打击
  - 模块损伤致命打击
related:
  - module-damage
  - ammo-rack
  - tracks
  - crew-role
  - engine-fire
anchors:
  specKeys:
    - engineHealth
    - fuelTankHealth
    - turretRingHealth
    - viewportHealth
  labels:
    - Module HP (max / repaired)
    - Module HP
---

对模块或车员造成的伤害，降低了车辆的作战能力，但不一定会减少生命值。

每一次命中都会检查击中点后面的目标。引擎、炮、履带、弹药架、油箱或车员都可能受到损坏或被摧毁，即使是未能穿透的炮弹也仍然可以造成伤害。

后果是具体的：受损的炮将失去准确性，受伤的装填手 reload 速度变慢，损坏的引擎降低动力，摧毁的弹药架将结束战斗。维修包修复模块，急救包治疗车员，而维修技能则决定了无人维护的模块恢复速度。
