# Flight Atlas · 飞行足迹

将 Flighty CSV 或 Excel 航班记录生成个人世界航线地图。纯静态网页，无需服务器接口或构建步骤。

## 功能

- 导入 CSV、XLSX、XLS；手动添加、编辑与删除航班
- 按日期统计、识别重复及取消记录，支持未来行程
- 自选地图配色、已到访航点的文字标注
- 最长与最短各两条不同航线，保留实际飞行方向
- 高清 PNG 图片及 Excel 航班记录导出
- IndexedDB 自动保存；数据仅保存在当前浏览器，不会跨设备同步

## 本地运行

安装 Python 3 后，在仓库目录运行：

```sh
python -m http.server 8000 --directory dist
```

打开 http://localhost:8000 。请通过 HTTP 服务访问，直接双击 HTML 文件可能无法加载数据。

## 部署

可将 `dist/` 发布到任意静态托管服务。仓库包含 GitHub Pages 手动部署工作流；在 Settings → Pages 中选择 GitHub Actions，然后从 Actions 运行 Deploy static site。

## 项目结构

- `dist/app.js`：导入、航线计算与图片导出
- `dist/editor.js`：航班记录管理
- `dist/labels.js`、`colors.js`、`palette.js`：标注与配色
- `dist/persistence.js`：浏览器本地保存
- `dist/workspace.js`、`workspace.css`：工作区布局
- `dist/templates/portrait.html`：海报模板
- `dist/data/`：机场、中文名称与世界地图
- `dist/vendor/`：本地第三方库

## 数据与依赖

机场地理信息来源于 [OurAirports](https://ourairports.com/data/)，底图来源于 [Natural Earth](https://www.naturalearthdata.com/)。中文名称词典覆盖部分常用机场，未覆盖时会显示原始名称。距离按机场间大圆距离估算，不代表实际执飞里程。

本项目使用 D3、TopoJSON Client、SheetJS 和 html-to-image。第三方代码与数据的许可证由其各自作者规定，见 THIRD_PARTY.md。

源码包不包含个人航班文件、浏览器本地记录、访问令牌或原托管平台配置。
