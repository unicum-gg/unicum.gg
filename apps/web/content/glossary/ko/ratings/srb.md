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

전투의 양으로 보상받는 강력한 요새 등급으로, 수백 번의 전투에서 검증된 클랜이 같은 SR을 가진 이십 개 클랜보다 높은 순위를 차지할 수 있다.

SR은 클랜이 얼마나 많이 플레이했는지를 일부러 무시한다. SRB는 그 동일한 등급에 후방의 전투로 성장하는 계수를 곱하여 만들어지므로 항상 기반이 되는 SR보다 높을 수밖에 없다.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

로그arithmic이며, 첫 번째 백 전투는 천 번째 전투보다 훨씬 더 큰 가치를 가진다. ```

목표는 모든 티어에서 일정한 양을 유지하는 것이다. 스커미시 티어 X는 연속적으로 진행되면서, 어드밴스는 매년 몇 주에 걸쳐서 운영되기 때문에 실제로 더 많이 플레이되는 티어는 더 큰 보너스를 받는다. 이는 스틸 헌터 보드에서 HRB가 HR과 함께 있는 것과 같은 개념이다.
