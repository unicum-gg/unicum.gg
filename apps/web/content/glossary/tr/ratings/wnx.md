---
term: WNX
aliases:
  - WNX rating
  - WNX derecelendirmesi
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

Bir yardım hasarını birlikte sayan ve tamamen galibiyet oranı terimini bırakan modern bir araç başına derecelendirmedir.

WNX, WN8'in biçimini ve her aracın beklenen değerlerine karşı oranlarını korur ve neyi saydığına değişiklikler yapar. İzleme ve radyo yardımı, değerlerinin üçte iki kadar hasara eklenir, bu nedenle bir müttefiğe ışık açmak veya bir paletin engellenmesi, yok sayılmak yerine katkı olarak puanlanır.

Galibiyet oranı bileşeni yoktur. Sonuca dayalı terimler, platoon oluşturmayı ve uzun hesapları, oyuncuyu ölçmekten daha fazla ödüllendirir, bu nedenle WNX yalnızca oyuncunun savaşta yaptıklarını puanlar: hasar artı yardım, öldürmeler ve görülmeler, aracın üretmesi beklenen değerlerle karşılaştırıldığında.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Not: Yukarıdaki formülle çözümleyin ve elde edilen sonucu kesirli veya tam sayı gösterebilirsiniz.

Sonuç üssü ölçek üstünü genişletir, bu nedenle iyi ve olağanüstü hesaplar arasındaki fark görünür kalır, sıkışmaz. ```

Beklenen değerler, büyük bir izlenen hesap örneğinden yeniden hesaplanan tomato.gg'den gelir. Bu, unicum.gg'deki varsayılan derecelendirmedir çünkü bir aracın bugün nasıl oynandığına en hızlı tepki verir.
