# Flight Atlas · 飞行足迹

将 Flighty CSV 或 Excel 航班记录生成个人世界航线地图。前端为静态网页，无需构建步骤；账号与云端备份使用 Supabase。

## 功能

- 导入 CSV、XLSX、XLS；手动添加、编辑与删除航班
- 按日期统计、识别重复记录，支持未来行程
- 自选地图配色、已到访航点的文字标注
- 机型收藏册：已乘坐机型点亮徽章，未乘坐置灰；未匹配机型保留名称并显示“暂无徽章”
- 最长与最短各两条不同航线，保留实际飞行方向
- 高清 PNG 图片及 Excel 航班记录导出
- IndexedDB 自动保存；游客与账号记录分开保存在当前浏览器；登录后可手动保存、恢复 Supabase 云端草稿

## 本地运行

安装 Python 3 后，在仓库目录运行：

```sh
python -m http.server 8000 --directory dist
```

打开 http://localhost:8000 。请通过 HTTP 服务访问，直接双击 HTML 文件可能无法加载数据。

## 静态托管（可选）

可将 `dist/` 发布到任意静态托管服务。仓库包含 GitHub Pages 手动部署工作流；在 Settings → Pages 中选择 GitHub Actions，然后从 Actions 运行 Deploy static site。

## 项目结构

- `dist/app.js`：导入、航线计算与图片导出
- `dist/editor.js`：航班记录管理
- `dist/labels.js`、`colors.js`、`palette.js`：标注与配色
- `dist/persistence.js`：浏览器本地保存
- `dist/account.js`、`cloud-backup-state.js`、`backup.js`：账号、云端与本地备份
- `dist/fleet.js`、`fleet.css`、`aircraft-catalog.js`：机型收藏册、徽章资料与别名
- `dist/workspace.js`、`workspace.css`：工作区布局
- `dist/templates/portrait.html`：海报模板
- `dist/data/`：机场、中文名称与世界地图
- `dist/vendor/`：本地第三方库

## 数据与依赖

机场地理信息来源于 [OurAirports](https://ourairports.com/data/)，底图来源于 [Natural Earth](https://www.naturalearthdata.com/)。中文名称词典覆盖部分常用机场，未覆盖时会显示原始名称。距离按机场间大圆距离估算，不代表实际执飞里程。

本项目使用 D3、TopoJSON Client、SheetJS、html-to-image 和 Supabase JS。第三方代码与数据的许可证由其各自作者规定，见 THIRD_PARTY.md。

源码包不包含个人航班文件、浏览器本地记录、访问令牌或原托管平台配置。

## 数据保护

在“我的账号 → 本地备份”中使用“导出备份文件”导出 JSON，包含航班、配色、标注和未来行程设置，不含登录凭据。Excel 用于航班表格交换，不作为完整备份。取消航班不纳入产品范围。

恢复 JSON 或云端记录前，先自动保留当前账号的一份本机副本；在“我的账号 → 本地备份”中点击“找回替换前副本”下载。每次替换更新这份副本，重要版本请另行下载。云端保存会先比较内容并确认替换；如果确认后另一台设备又更新了云端，本次保存会被拒绝，本机修改保留。核对最新数量与时间后，可重新保存本机或恢复云端；重要记录建议先另行导出本地备份。账号配置见 ACCOUNT_SETUP.md。

## Cloudflare Workers 部署

仓库根目录的 `wrangler.json` 将 `dist/` 作为静态资源目录，并启用 Workers Previews。Cloudflare 构建根目录应为仓库根目录，无需构建命令；生产部署命令为 `npx wrangler deploy`，非生产分支预览命令为 `npx wrangler preview`。不需要新增 Worker 脚本或数据库绑定。

预览域名的浏览器本地记录与正式域名隔离。测试时使用虚构航班；若测试账号登录，需要在 Supabase 添加预览回调地址。

## 航班排序与起飞时间

航班记录列表仍只显示日期；列表与收藏册航班详情的排序按日期、出发地当地起飞时间从新到旧；同一天未填写时间的记录放在有时间的记录之后。添加或编辑航班时可选填起飞时间。导入支持 `Departure Time`、`Scheduled Departure Time`、起飞时间、出发时间，以及 Flighty 的 `Gate Departure (Scheduled)`、`Take off (Scheduled)` 等列。优先读取明确的起飞时间和计划时间；为空时尝试实际时间，再读取日期单元格中的时分；Excel 导出包含 `Departure Time`。JSON 与云端备份自动保留时间。此前仅保存日期的记录需重新导入含时间的原文件或手动补填，系统不会猜测历史起飞时间。

## 导入与编辑反馈

航班记录保存与地图生成分别报告结果。导入或编辑后如有无效日期、未知机场等问题，记录会保留，提示“地图未生成”及原因，可在航班记录中继续修正。世界底图或海报模板加载失败不影响已加载机场数据库的航班编辑。
