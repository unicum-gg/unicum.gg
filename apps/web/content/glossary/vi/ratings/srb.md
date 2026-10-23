---
term: Xếp hạng Pháo đài dựa trên số trận
aliases:
  - SRB
  - xếp hạng Pháo đài theo số trận
related:
  - sr
  - stronghold
  - advances
  - mr
links:
  - target: stronghold
anchors:
  labels:
    - SRB
    - Battles-based Stronghold Rating
---

Xếp hạng Pháo đài trong đó số lượng trận được tính thưởng thay vì chỉ dùng làm ngưỡng điều kiện, vì vậy một clan đã chứng tỏ năng lực qua hàng trăm trận sẽ xếp trên một clan có cùng SR nhưng chỉ qua hai mươi trận.

SR chủ ý không tính đến tần suất thi đấu của clan. SRB lấy chính xếp hạng đó rồi nhân với một hệ số tăng theo số trận đã đấu, vì vậy nó luôn chỉ có thể cao hơn SR dùng làm cơ sở.

```formula
SRB = SR x (1 + ln(1 + battles / 1000))

Theo thang logarit, vì vậy một trăm trận đầu tiên có giá trị lớn hơn rất nhiều so với trận thứ một nghìn. ```

Một hằng số số trận được cố ý áp dụng cho mọi Cấp: Tranh chấp Cấp X được chơi liên tục, trong khi Tiến công diễn ra theo từng đợt trong vài tuần mỗi năm, vì vậy những Cấp thực sự được chơi nhiều hơn sẽ nhận phần thưởng lớn hơn. Phần thưởng theo số trận là yếu tố phân biệt một clan đã duy trì xếp hạng qua hàng trăm trận với một clan đạt được xếp hạng đó chỉ sau hai mươi trận.
