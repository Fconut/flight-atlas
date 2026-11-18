# 微信云端部署

环境：`cloud1-d5g931htr9ee8f18c`；AppID：`wx31f3f3739a7a1743`。

1. 部署 `atlas-account`，选择云端安装依赖（固定 wx-server-sdk 4.0.2）。
2. 在此环境的文档型数据库创建集合 `mini_atlas_drafts`，权限选择“无权限／仅管理端可读写”。也可在安全规则中使用 `database.rules.json` 的 `read:false, write:false`。前端只经云函数访问数据。
3. 确认集合权限后才启用 `atlas-account/deployment.json` 的 `backupEnabled`。当前环境的权限已由所有者确认，已启用。重新部署到其他环境前，先改为 `false`，核对权限后再启用；紧急停用可设置函数环境变量 `ATLAS_BACKUP_ENABLED=false`。
4. 在体验版测试自动微信身份识别、两位微信用户隔离、导入和增删改后的自动保存、关闭后恢复、断网重试和并发修改。本机旧记录只迁移一次，来源保留；小程序不再提供账号面板或手动备份入口。

云函数仅接受当前 AppID 的可信微信上下文，忽略客户端传入的账号或 OpenID。事务校验版本后才更新当前用户的文档。整个小程序不再访问网页版 Supabase。

请勿把数据库设为所有用户可读。无需提供 AppSecret、服务端密钥，也无需开启 HTTP 访问。
