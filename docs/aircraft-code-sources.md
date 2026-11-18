# 第一批机型代码核对

范围：737、A320、A330、A350、747-400、767-300、777-300ER、787-8/9 与 A220-300。机场运营方表列可能同时包含 IATA 和机场内部代码，不将所有列值一概宣称为通用 IATA 标准。

来源：
- EuroAirport Aircraft Type List 2023（机场运营资料）：https://www.euroairport.com/sites/default/files/medias/file/2025/06/Aircraft_Type_List_%202023.pdf
- EUROCONTROL A320neo / A20N 示例：https://eurocontrol.github.io/eurocontrol/reference/aircraft_model.html
- FAA type designator reference：https://www.faa.gov/air_traffic/publications/atpubs/foa_html/appendix_3.html

规则：
- 完整代码先匹配，再进行品牌和标点归一化；B737 可识别，裸 737 仍保留为系列描述。
- 保留 737-800 与 MAX 8、A320 与 A320neo、A321 与 A321neo 的区别。
- B739 对应粒度可能覆盖不同衍生型号，暂不加入。A320-200 也暂不强行合并到现有 A320 目录项。
- 新增纯数据项：737-400、737-500、737-600、737 MAX 9、A318、A319neo。A319neo、737 MAX 9 已接入徽章，其余四项暂不附图；不自动修改用户原始机型文本。

## 别名与搜索统一（2026-11-09）

- 增加已核对代码 A332/332、A333/333、A359/359、A35K/351、B744/744、B763/763、B77W/77W、B788/788、B789/789、BCS3/223。来源为上列 EuroAirport 表。
- B772 不强分 777-200/200ER；B77L 同时可能指货机与 200LR，暂不合并。货机代码不套用客机徽章。
- 支持全角英数、中文品牌、已知旧称（如庞巴迪 CS300）。Dash 8 系列不再直接归为 Q400。
- 手动添加与数据检查共用 searchAircraft；文件和识别导入保留原始文本，收藏及分享统一经 resolveAircraft/aircraftIdentity 匹配。
## 第二批目录与徽章（2026-11-09）

新增数据：A220-100、E175、E190-E2、E195-E2、757-200、747-8I。前三枚 A220-100、E175、757-200 已绘制并接入，共 49 款目录、42 枚徽章。其余三款暂未附图。

已核对代码：BCS1/221、B752/752/75W 来自 EuroAirport 表；E75L/E75S/E7W/E75、E290/290、E295/295 来自 Swedavia 机场规划资料：
https://www.swedavia.net/airport/landvetter/innehall/Documents/Uppstallningsplanen%20Goteborg%20Landvetter%20Airport.pdf

B748/748 可能覆盖 747-8 客货版本，暂不自动归为客机；明确的 747-8I 可匹配。

第二批补图完成：E190-E2、E195-E2、747-8I 已附徽章，现有目录 49 款、徽章 45 枚。匹配规则未改变，B748/748 仍不自动视为客机。
