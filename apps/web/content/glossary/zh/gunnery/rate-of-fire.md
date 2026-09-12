---
term: 射速
aliases:
  - ROF
  - 每分钟发射的弹药数
  - RPM
related:
  - reload
  - dpm
  - alpha-damage
  - magazine
anchors:
  specKeys:
    - rof
  labels:
    - Rate of fire
---

一门枪在一分钟内可以发射多少炮弹，其值为装填时间的倒数。

射速是用相反的方式表示的装填速度：一门在十秒内装填的枪每分钟发射六发炮弹。将其乘以 alpha 就得到了 DPM，这就是为什么这三个数字不会被孤立地读取。

对于弹夹枪来说，这个数值是整个循环的平均值，因此它掩盖了爆发：枪在二十秒内没有动作，然后在六秒内发射四发炮弹。
