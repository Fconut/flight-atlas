# ICAO 归类调整（2026-11-09）

用户确认：一个 ICAO 代码对应一枚徽章；ATR 仅收录 ATR 42-600（AT46）、ATR 72-600（AT76）；界面不新增 ICAO 小字。

- 49 个目录项各带唯一 icao 字段，保留既有内部 ID 以减少已有链接/筛选的兼容影响。
- 777-200/200ER 归 B772，同一枚徽章，原始航班型号文字不变。已有 777-200 图作为通用图，现有 ER 图仅用于历史分享。
- E175 拆 e175-short（E75S）与 e175-long（E75L），各有新图。E75/E7W 分别归短/长翼；裸 E175/ERJ175 不猜测。
- ATR42/ATR72 泛称不再代表 -600；ATR42-500、ATR72-500 及 AT45/AT75 不误归入 -600。
- B748 对应现有 747-8 分类，747-8I/-8F 同码；B77L 同时归 777-200LR/777F。商品名称保留在原始航班。
- 完整 ICAO 代码均可搜索、解析；B737 仍是 737-700，裸 737 仍不猜测。
- A319-100/A320-200/A321-200 归相应 ceo 代码，不再把商业后缀误当另一枚徽章。
- 搜索、筛选、收藏、单枚/整本分享复用同一 resolver，无需改写或迁移云端历史航班。
- 历史分享引用的旧图片文件保留。新图使用新路径，避免改变旧分享快照。

依据：
- https://www.faa.gov/documentLibrary/media/Order/7210.3DD_Bsc_w_Chg_1_and_2_dtd_3-21-24.pdf
- https://www.faa.gov/documentLibrary/media/Order/2021-10-07_Order_JO_7360.1F_Aircraft_Type_Designators.pdf
- https://www.euroairport.com/sites/default/files/medias/file/2025/06/Aircraft_Type_List_%202023.pdf
- https://docs.cascade.boeing.com/docs/aircraft/fleetRenewal.html

本轮四幅图由内置图像工具制作，以现有 ATR42/ATR72/E175 为风格参考，分别标注 ATR 42-600、ATR 72-600、EMBRAER E175 LONG WING、EMBRAER E175 SHORT WING；金色波浪圆边、天空云层、象牙白飞机与绶带，透明底，无 ICAO 文字。原图保留 outputs/*-master.png。

## 2026-11-10：新增五类

仅新增 B739（737-900/900ER）、CRJ7（CRJ700）、CRJ9（CRJ900）、E170、A343（A340-300），54 个代码分类、50 枚徽章。没有新增 A346。

代码来源沿用 FAA JO7360.1H 与 EuroAirport 对照表；CR7/CR9/E70 等输入别名不作为展示分类代码。737-900 与 900ER 同属 B739。

五张图片由内置图像工具按现有金边圆形珐琅系列生成：737-900 青金、CRJ700 蓝金、CRJ900 青金、E170 蓝金、A340-300 蓝金。分别突出加长 NG 机身、CRJ 后置双发/T 尾、紧凑 E170 和 A340 四发结构。A340 初稿发动机数量错误已重新生成修正，仅四发版用于正式资源。透明 PNG 原图在 outputs/*-master.png，应用使用 640×640 压缩衍生图。新图分布在 badges1、badges3，避免已有分包超限。
