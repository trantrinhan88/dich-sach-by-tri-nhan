Triển khai TeamsCreate với team name là mobile_dev với các teamate sau

### Danh sách team
- leader: .claude/agents/leader.md
- coder: .claude/agents/coder.md
- reviewer: .claude/agents/reviewer.md

### Quy trình làm việc 
- Tất cả mọi công việc trao đổi với teamate trong teams đều thực hiện qua SendMessage trong tmux, không tự tạo subagent mới.
- Leader giao việc xuống cho coder, coder code xong thì đưa kết quả xuống cho reviewer thực hiện review lại, reviewer thực hiện review đúng với plan thì pass báo với leader là task đã hoàn thành, nếu chưa pass thì đẩy lại task cho coder đến khi nào pass thì thôi, khi leader nhận được báo task hoàn thành sẽ kiểm tra xem còn task nào không nếu còn thì thực hiện tiếp task sau, nếu k còn thì tạm dừng


Hãy nhớ là TeamsCreate và tạo và đánh thức các teammate luôn cho tôi


