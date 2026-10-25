---
term: Chỉ số WNX
aliases:
  - WNX rating
  - xếp hạng WNX
  - WNX
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

Một chỉ số theo từng xe hiện đại, tính cả sát thương hỗ trợ cùng với sát thương gây ra và loại bỏ hoàn toàn yếu tố tỷ lệ thắng.

WNX giữ cấu trúc của WN8, các tỷ lệ so với giá trị kỳ vọng theo từng xe và thay đổi những gì nó tính. Hỗ trợ do trinh sát và phá xích được cộng vào sát thương với hai phần ba giá trị của chúng, vì vậy việc phát hiện mục tiêu cho đồng minh và phá xích đối phương được ghi nhận đúng với mức đóng góp của chúng thay vì bị bỏ qua.

Chỉ số này không có thành phần tỷ lệ thắng. Các yếu tố dựa trên kết quả thưởng cho việc lập Trung đội và tài khoản có thời gian chơi lâu hơn mức chúng đo lường người chơi, vì vậy WNX chỉ chấm điểm những gì người chơi đã làm trong trận đấu: sát thương cộng với sát thương hỗ trợ, số xe địch bị tiêu diệt và số mục tiêu phát hiện được, so với mức mà chiếc xe được kỳ vọng tạo ra.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Số mũ ở phần cuối kéo giãn phần trên của thang điểm, vì vậy khoảng cách giữa một tài khoản tốt và một tài khoản xuất sắc vẫn được thể hiện thay vì bị nén lại. ```

Các giá trị kỳ vọng được tính lại từ một mẫu lớn gồm những tài khoản được theo dõi. Đây là chỉ số mặc định trên unicum.gg vì nó phản ứng nhanh nhất với cách một chiếc xe thực sự được chơi hiện nay.
