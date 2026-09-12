---
term: WN8
aliases:
  - WN8 rating
  - wn8 skoru
related:
  - wn7
  - wnx
  - expected-values
  - recent-stats
  - rating-colors
  - wtr
links:
  - target: top-players
anchors:
  labels:
    - WN8
---

Bir oyuncunun oynadığı tankların beklenen hasar, öldürme, keşif ve üs savunması ile karşılaştırılan topluluk performans derecelendirmesi, üzerine bir kazanma oranı terimi eklenmiştir.

WN8, ham ortalamanın cevaplayamayacağı bir soruya yanıt verir. Savaş başına 1,800 hasar kötü mü? Tier X ağır tankında sıradan bir performansken, Tier V orta tankında olağanüstü bir değerdir. WN8, bir hesap üzerindeki her tankı, o tank için sunucu ortalaması ile karşılaştırır, bu nedenle çoğunlukla Tier VI oynayan bir oyuncu, tüm oyuncu kitlesi yerine Tier VI'ya karşı ölçülür.

2013 yılında WN ekibi tarafından WN7'nin halef olarak yayınlandı, çünkü WN7'nin seviye cezası kolayca kullanılabiliyordu. Beş oran bunu besliyor: hasar, öldürme, keşif, kaydedilen kontrol puanları ve kazanma oranı; her biri oynanan tanklar için beklenen değere bölünüyor, sıfıra indirilmiş ve hasar terimi ile sınırlandırılmıştır, böylece tek bir güçlü eksen diğerlerini sırtlayamaz.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Her oranın burada düzeltilmiş hali: ham oranının tabanı ile kaydırılmış şekli, çarptığı hasar oranı ile sınırlandırılmıştır. ```

Hasar yaklaşık olarak ağırlığın üçte ikisini taşır ki bu, bununla ilgili yaygın bir şikayettir: pasif bir oyuncu, arkadan hasar farm yaparak mevcut sayılardan daha iyi skor alır. Kazanma oranı terimi 1.8 ile sınırlandırılmıştır, bu nedenle güçlü bir platoon zayıf bir hesabı sonsuz bir şekilde yükseltmekte etkili olamaz.

Beklenen değerler sunucunun bir anlık görüntüsü olduğu için WN8, oyuncu kitlesi ve araçlar değiştikçe dalgalanır. Güçlenen bir tank, bir sonraki veri seti güncellemesinde onu kullanan herkes için standartları yükseltir. WN8 ayrıca bir hesabın tamamı boyunca yığılmaz, bu nedenle birkaç bin erken savaş, yıllar sonra hâlâ etkisini sürdürdüğü için çoğu oyuncu son WN8'lerini izlemeyi tercih eder.
