---
term: Critical hit
aliases:
  - crit
  - 크리티컬 데미지
  - 모듈 데미지 크리티컬
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

모듈이나 승무원에게 피해를 주어 차량의 성능을 저하시키지만 반드시 Hit Points를 잃게 하지는 않습니다.

모든 공격은 타격 지점 뒤에 있는 것이 무엇인지 확인합니다. 엔진, 포, 트랙, 탄약고, 연료 탱크 또는 승무원이 피해를 입거나 파괴될 수 있으며 관통에 실패한 포탄도 여전히 크리티컬 히트를 발생시킬 수 있습니다.

결과는 구체적입니다: 피해를 입은 포는 정확도를 잃고, 부상당한 로더는 재장전 속도가 느려지며, 파괴된 엔진은 출력을 줄입니다. 파괴된 탄약고는 전투를 종료합니다. 수리 키트는 모듈을 수리하고, 응급 처치 키트는 승무원을 치료하며, 수리 기술은 방치된 모듈이 얼마나 빨리 회복되는지를 결정합니다.
