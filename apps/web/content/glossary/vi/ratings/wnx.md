---
term: WNX
aliases:
  - WNX rating
  - xếp hạng WNX
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

Một hệ thống xếp hạng hiện đại theo từng xe, tính cả sát thương hỗ trợ bên cạnh sát thương gây ra và hoàn toàn bỏ qua thuật ngữ tỷ lệ thắng.

WNX giữ hình dạng của WN8, tỷ lệ so với giá trị dự kiến cho từng xe, và thay đổi những gì nó tính. Theo dõi và hỗ trợ từ xa được cộng vào sát thương với hai phần ba giá trị của chúng, vì vậy việc phát hiện cho đồng đội và chặn đường chạy được ghi nhận như là những đóng góp mà chúng thực sự có chứ không bị lãng quên.

Nó không có thành phần tỷ lệ thắng. Các thuật ngữ dựa trên kết quả thưởng cho việc phối hợp và tài khoản lâu dài hơn là đo lường người chơi, vì vậy WNX chỉ tính những gì người chơi đã làm trong trận đấu: sát thương cộng với hỗ trợ, tiêu diệt và phát hiện so với những gì xe được kỳ vọng sẽ sản xuất.

```formula
raw = 750 x rDAMAGE + 200 x rFRAG + 50 x rSPOT, then raw x (raw / 1000) ^ 0.45 x 1.65

Phần số mũ kéo dài đầu của thang, do đó khoảng cách giữa một tài khoản tốt và một tài khoản xuất sắc vẫn được hiển thị thay vì bị nén. ```

Các giá trị dự kiến đến từ tomato.gg, nơi tính toán lại chúng từ một mẫu lớn các tài khoản đã được theo dõi. Đây là xếp hạng mặc định trên unicum.gg vì nó phản ứng nhanh nhất với cách mà một xe thực sự được chơi ngày hôm nay.
