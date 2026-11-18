# 配色资源维护

唯一内容源：`design/palette-library/catalog.v1.json`。描述、色值及高清资源路径均在这里维护。`previewAsset` 绑定固定ID，不能按当前列表顺序重新计算；修改显示顺序不会改变分包路径。

- `node scripts/palette-library/build.cjs`：只同步轻量目录，不重编码图片。
- `node scripts/palette-library/build.cjs --check`：只读核对目录及100张高清图引用。
- `node scripts/palette-library/build.cjs --images`：明确重新生成全部图片，需配置 `@napi-rs/canvas` 或 `ATLAS_CANVAS_MODULE`；不在小程序运行时执行。

图片沿用正式海报渲染器、固定非用户样本和2160像素宽度。JPEG为开发者工具可实际打包的格式。文件名、尺寸及资源revision需一起维护，不能以生成成功代替实际代码包检查。

生成100款配色时共用同一份航线布局及画布；全部画面会由正式渲染器完整覆盖，不叠加上一款配色。目录、图片和缩略图只有字节内容变化时才写回，避免无变化的资源同步和开发者工具重编译。`--images`仍会执行渲染验证，不代表跳过图片生成。

小程序不同分包的组件注册不能用运行时路径代替。新增高清资源分包时还需更新app.json、配色详情组件注册和打包包含配置，并运行结构审计与预览核对。

历史视觉草稿和旧生成脚本归档在工作区 `archive/palette-prototypes-2026-11-15`，不进入小程序代码包。
