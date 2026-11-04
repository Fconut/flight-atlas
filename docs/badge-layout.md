# 徽章布局预计算

收藏册使用 dist/badge-layout.js 的有效边界和变换值，浏览器不再创建 Canvas 或读取像素。图片原文件保持不变，透明度阈值仍为 alpha > 32，缩放和偏移沿用原公式。

新增或替换 dist/assets/aircraft-ribbon/*.webp 后，在本地执行：

```sh
python -m pip install Pillow
python scripts/build-badge-layout.py
node --test tests/*.test.cjs
```

脚本只读取图片并生成元数据，不修改图片。CI 使用 Node.js 核对目录中的每枚徽章是否有布局数据、图片 SHA-256 是否匹配，以及变换公式是否一致；运行测试不需要安装 Pillow。若图片更新后漏生成布局数据，测试会明确提示命令。

布局脚本须在 fleet.js 前加载。未匹配布局的新图暂以原始大小显示，不回退到浏览器像素扫描。
