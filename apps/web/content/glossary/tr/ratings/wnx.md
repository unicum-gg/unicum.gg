---
term: WNX
aliases:
  - WNX rating
  - WNX puanı
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

Modern bir araç başına performans puanı olan WNX, verilen hasarın yanı sıra yardım hasarını da hesaba katar ve galibiyet oranı bileşenini tamamen çıkarır.

WNX, WN8'in yapısını ve araç başına beklenen değerlere oranları korur, ancak hesaba kattığı şeyleri değiştirir. Keşif ve telsiz yardımı, değerlerinin üçte ikisi oranında hasara eklenir, böylece bir müttefik için tespit yapmak ve palet kırmak göz ardı edilmek yerine, gerçekte oldukları katkı olarak puanlanır.

Galibiyet oranı bileşeni yoktur. Sonuç temelli ölçütler, oyuncuyu ölçmekten çok müfreze kurmayı ve eski hesapları ödüllendirir, bu nedenle WNX yalnızca oyuncunun savaşta yaptıklarını puanlar: aracın üretmesi beklenen değere kıyasla hasar artı yardım hasarı, imha edilen araçlar ve tespitler.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Üstteki üs, ölçeğin üst kısmını genişletir, böylece iyi ve olağanüstü bir hesap arasındaki fark sıkışmak yerine görünür kalır. ```

Beklenen değerler, takip edilen hesaplardan oluşan büyük bir örneklem kullanılarak yeniden hesaplanır. WNX, bir aracın bugün gerçekte nasıl oynandığına en hızlı tepki verdiği için unicum.gg üzerindeki varsayılan puandır.
