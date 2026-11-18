# 印章素材目录

- catalog.v1.json：稳定编号、名称、系列；已有权益使用这些编号。
- artwork.v2.json：100份原图的对应格位、文件路径和SHA-256。
- masters/：重绘原始透明PNG，不直接打包。
- archive/：已弃用的矢量生成器，仅作历史留档，不参与构建。

运行素材仅在 miniprogram/stamps0 至 stamps3，每包25枚。缩略总览在 miniprogram/assets/collection/stamps.jpg。

重建：node scripts/stamps/build.cjs --images
校验：node scripts/stamps/build.cjs --check

禁止把设计原图或旧版图片复制进运行分包。校验遇到多余图片、源图变更或超限会失败，不自动删除文件。
