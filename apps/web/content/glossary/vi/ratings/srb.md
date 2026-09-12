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

Xếp hạng Cứ điểm Dựa trên Trận chiến là cách tính điểm xếp hạng để phần thưởng dựa vào số trận đã chơi thay vì chỉ dựa vào tỷ lệ, vì vậy một Clan đã chứng minh năng lực của mình qua hàng trăm trận đấu sẽ xếp trên một Clan có cùng SR nhưng chỉ chơi hai mươi trận.

SR cố ý bỏ qua số trận mà một Clan tham gia. SRB lấy xếp hạng đó và nhân nó với một yếu tố tăng lên theo số trận đấu, vì vậy nó chỉ có thể cao hơn SR mà nó được xây dựng trên đó.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Logarit, nên một trăm trận đầu tiên có giá trị cao hơn rất nhiều so với trận thứ nghìn. ```

Một hằng số thể tích xuyên suốt mọi cấp độ, theo mục đích: Cấp độ Khúc chiến X được chơi liên tục trong khi Cấp độ Tấn công diễn ra theo từng đợt vài tuần trong một năm, vì vậy các cấp độ thực sự được chơi nhiều hơn sẽ nhận được phần thưởng lớn hơn. Đây là cùng một ý tưởng như HRB bên cạnh HR trên bảng xếp hạng Steel Hunter.
