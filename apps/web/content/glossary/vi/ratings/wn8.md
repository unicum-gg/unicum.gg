---
term: WN8
aliases:
  - WN8 rating
  - điểm wn8
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

Một chỉ số đánh giá hiệu suất cộng đồng chấm điểm một người chơi dựa trên sát thương, số lần tiêu diệt, spotting và phòng thủ căn cứ dự kiến của các phương tiện mà họ thực sự chơi, với một chỉ số tỷ lệ thắng thêm vào.

WN8 trả lời một câu hỏi mà một trung bình thô không thể. 1.800 sát thương mỗi trận có tốt không? Với một xe tăng hạng nặng Tier X thì không có gì đặc biệt, nhưng với một xe tăng trung bình Tier V thì là xuất sắc. WN8 so sánh mọi phương tiện trên một tài khoản với trung bình máy chủ cho cùng một phương tiện, vì vậy một người chơi chủ yếu lái Tier VI sẽ được đo lường theo Tier VI chứ không phải với toàn bộ dân số.

Nó được công bố vào năm 2013 bởi đội ngũ WN như là người kế nhiệm của WN7, mà mức phạt tầng làm cho dễ bị thao túng. Năm tỷ lệ cung cấp cho nó: sát thương, số lần tiêu diệt, spotting, điểm chiếm bị rơi và tỷ lệ thắng, mỗi tỷ lệ được chia cho giá trị dự kiến của các phương tiện đã chơi, tối thiểu là zero và bị giới hạn theo chỉ số sát thương để một trục mạnh không thể gánh chịu các chỉ số còn lại.

```formula
980 x rDAMAGE + 210 x rDAMAGE x rFRAG + 155 x rFRAG x rSPOT + 75 x rDEF x rFRAG + 145 x min(1.8, rWIN)

Mỗi tỷ lệ ở đây là hình thức đã được sửa: tỷ lệ thô được điều chỉnh theo giá trị tối thiểu của nó, bị giới hạn bởi tỷ lệ sát thương mà nó nhân. ```

Sát thương chiếm khoảng ba phần tư trọng số, điều này là phàn nàn thông thường về nó: một người chơi thụ động kiếm sát thương từ phía sau có điểm số cao hơn những gì mà các con số có thể xứng đáng. Tỷ lệ thắng được giới hạn ở 1.8 để một đội mạnh không thể làm tăng một tài khoản yếu mãi mãi.

Bởi vì các giá trị dự kiến là một ảnh chụp nhanh của máy chủ, WN8 thay đổi khi dân số và các phương tiện thay đổi. Một chiếc xe tăng được tăng cường sẽ nâng cao tiêu chuẩn cho tất cả những ai lái nó vào bản cập nhật dữ liệu tiếp theo. WN8 cũng là cộng dồn qua toàn bộ lịch sử của một tài khoản, vì vậy một vài nghìn trận đầu tiên vẫn tiếp tục ảnh hưởng đến nó nhiều năm sau, đó là lý do tại sao hầu hết người chơi theo dõi WN8 gần đây của họ hơn.
