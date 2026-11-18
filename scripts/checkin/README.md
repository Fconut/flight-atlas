# 签到奖励维护

固定奖励以 cloudfunctions/atlas-checkin/rewards.json 为维护源，不要单独修改客户端生成清单。

- 同步：node scripts/checkin/sync-rewards.cjs
- 只检查：node scripts/checkin/sync-rewards.cjs --check

脚本从任意工作目录运行，校验56款唯一、非免费配色；按累计1、7、14天等节点生成 miniprogram/lib/checkin-rewards.js。该工具不连接数据库、不重置用户、不部署云函数。调整顺序后仍需测试，并分别同步小程序与部署云函数。
