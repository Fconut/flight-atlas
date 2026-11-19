# Flight Atlas · 飞行足迹

把航班记录绘成个人世界航线海报，同时收集机型徽章、海报配色与旅途印章。本仓库包含微信小程序和静态网页版，两端的账号与云端保存相互独立。

## 微信小程序

- 四个主标签：足迹、徽章、航班、收藏。
- 导入 CSV / Excel，核对并选择记录；支持手动编辑、模糊搜索与数据检查。
- 自定义海报统计内容、标题、配色、航点标注与一枚旅途印章；支持航线回放、高清导出和专属分享。
- 海报配色100款、旅途印章100枚，收藏素材按需分包加载。
- 累计签到奖励：配色第1、8、15……天；印章第2、9、16……天。漏签不清零，不按年份重置。
- 微信云开发负责身份、航班备份、签到权益与分享；本地缓存、请求合并和内容复用减少重复调用。

当前开发版为 **0.1.41**；上传成功不代表已提交审核、正式发布或全部真机验收通过。广告与付费解锁尚未作为已上线能力。

### 开发与检查

使用微信开发者工具导入 `miniprogram/`。开发自己的实例时，修改项目 AppID 和 `lib/cloud-config.js`，并参考[云端部署说明](cloudfunctions/README.md)配置自己的环境；不要沿用本项目的生产环境。

```sh
node --test miniprogram-tests/*.test.cjs
node scripts/stamps/build.cjs --check
node scripts/checkin/sync-rewards.cjs --check
node scripts/palette-library/build.cjs --check
node scripts/audit-mini-structure.cjs
```

图片原稿不会在启动时全部加载；重建素材所需的图片工具见对应构建脚本，日常测试和素材清单校验不需要安装图片处理依赖。上传与云函数部署由开发者手动执行，GitHub Actions不会自动发布小程序。

## 网页版

`dist/` 是可直接托管的静态站点；网页版云端备份使用Supabase。

```sh
python -m http.server 8000 --directory dist
node --test tests/*.test.cjs
```

打开 http://localhost:8000 。完整功能、备份与托管配置见[网页版指南](docs/web-guide.md)和[账号配置](ACCOUNT_SETUP.md)。

## 目录导航

| 目录 | 内容 |
| --- | --- |
| miniprogram/ | 微信小程序运行代码与压缩资源 |
| cloudfunctions/ | 微信身份、备份、签到、分享及预留服务 |
| miniprogram-tests/ | 小程序与云端逻辑回归测试 |
| dist/ | 静态网页版与本地依赖 |
| tests/ | 网页版回归测试 |
| design/ | 素材原稿、稳定目录和历史设计；不直接打包进小程序 |
| scripts/ | 素材构建、清单同步与结构校验 |
| docs/ | 产品规则、部署、资料来源与维护记录 |
| licenses/ | 第三方许可证 |

进一步查看[文档索引](docs/README.md)、[第三方资料与授权](THIRD_PARTY.md)。

## 数据与安全

机场位置来自OurAirports等资料，陆地轮廓基于Natural Earth，详见授权记录。航线按机场间大圆路径绘制，里程不代表实际执飞轨迹。

仓库不应包含个人航班文件、数据库导出、登录凭据或私钥。微信数据库权限应限制客户端直接读写，由云函数校验身份与权益；密钥只配置在服务端环境中。本地私有开发者设置及依赖目录已忽略。
