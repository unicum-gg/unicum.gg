---
term: Critical hit
aliases:
  - crit
  - क्रिटिकल डैमेज
  - मॉड्यूल डैमेज क्रिट
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

Damage to a module or a crew member, which degrades what a vehicle can do without necessarily costing it hit points.

हर हिट यह जांचता है कि प्रभाव के बिंदु के पीछे क्या है। एक इंजन, एक तोप, एक ट्रैक, एक गोला-बारूद रैक, एक ईंधन टैंक या एक चालक दल का सदस्य क्षति या नष्ट हो सकता है, और एक गोला जो प्रवेश करने में असफल होता है, वह भी एक नुकसान पहुंचा सकता है।

परिणाम विशिष्ट होते हैं: एक क्षतिग्रस्त तोप सटीकता खो देती है, एक घायल लोडर धीमा रीलोड करता है, एक टूटे हुए इंजन में शक्ति कम हो जाती है, एक नष्ट गोला-बारूद रैक लड़ाई को समाप्त कर देता है। मरम्मत किट मॉड्यूल को ठीक करती हैं, पहला चिकित्सा किट चालक दल को ठीक करता है, और मरम्मत कौशल तय करता है कि एक बिना देखभाल किए गए मॉड्यूल कितनी जल्दी वापस आता है।
