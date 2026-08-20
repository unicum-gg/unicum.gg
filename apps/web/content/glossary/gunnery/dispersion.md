---
term: Dispersion
aliases:
  - spread
  - aiming circle size
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

The size of the aiming circle at any moment, which grows with movement and shrinks as the gun settles.

Dispersion is the live value behind accuracy. It starts from the gun's base figure and is multiplied by every penalty currently in effect: driving, turning the hull, traversing the turret, taking damage, firing.

The interface shows it as the reticle. A wide circle is not just a worse chance to hit, it is a shot that may land anywhere in it, which is why experienced players wait rather than fire into a circle wider than the target.
