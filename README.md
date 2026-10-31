# 课序 iOS 课表

面向湖北工业大学工程技术学院学生的课表工程，使用 React Native、Expo SDK 57 与 Expo Router。当前版本为 **0.1.0 开发版**。提供原生 iOS 客户端和可添加到 iPhone 主屏幕的网页端；网页端通过同源服务器连接学校教务系统。

手机统一入口：[打开课序](https://errand-sprint-recess.ngrok-free.dev/)。网页、教务登录与课程同步均使用这个 HTTPS 地址，个人电脑关机后仍可访问。

服务器公网 IP `http://8.148.69.59/` 只用于隧道故障时的应急排查。免费额度、服务器到期日和运维说明见 [云服务器部署](docs/云服务器部署.md)。

## 当前已经写好的功能

- 原生今日页、周课表、课程详情、变更记录与设置；浅色和深色模式、安全区域、大字体布局。
- 绑定页填写已核实的教务网址、学号和密码。原生 App 只在本次绑定时把学号与密码填入学校原登录页，由用户完成验证码和提交；凭据不写入本机缓存或开发者服务器。网页端的登录流程见下文。
- 学校登录成功后自动打开课表；若学校页面没有自动跳转，可点学校页面顶部的“读取课表”重试。登录页打开期间暂停定时重载，避免清掉尚未提交的表单。
- 解析课程号、课序号、教师、周次、单双周、节次、教室和跨行合并；附属课堂独立保留，未排时间课程不会丢失。
- 进入前台自动核对，前台每5分钟检查，30秒内的重复请求会被抑制；登录过期、学校离线或重新登录期间继续显示最后一次成功同步的课表。
- 校验通过后原子替换缓存，记录课程前后变化；异常、空表、未知格式保留旧数据。检测到课程安排减少或学期变化时，至少间隔30秒的两个一致快照后才应用。
- 离线缓存与上课前本地提醒；最多滚动安排未来50次提醒，课表更新后取消旧提醒再重新安排。
- 解绑时清理本地课表、变更、提醒及本 App 的 WebKit 登录状态；没有读取电脑 Edge/Safari 的 Cookie。
- 明确标识的虚构演示数据与“演示教室变更”操作。真实学生课表、姓名、学号、密码均未写入源码或测试数据。

## 当前尚未完成的部分

**原始需求中的全天候实时同步尚未实现。** 现在是在打开应用/网页及前台使用时自动同步。关闭后不持续读取学校，无法保证立即发现变更，也无法立即撤销尚未得知的旧本地提醒。

尚未实现：学校授权的持续后台服务、APNs 远程变更推送、桌面/锁屏小组件、系统日历联动、特殊校历调休映射。只有学校课程表反映的变更才会被读到；仅在公告或教师消息中的调整不能由此解析器发现。

尚未生成签名 IPA、上传 TestFlight 或在 iPhone 17 Pro Max 上运行。Windows 的类型检查、测试和 iOS JavaScript bundle 导出，均不能替代 Xcode 原生编译或真机验收。

## 在 Windows 开发和预览

使用 Node.js 24 LTS（最低22.13）与 npm。可在 [Node.js 官网](https://nodejs.org/)下载安装；不需要在 Windows 安装 Xcode。已有环境使用系统 Node 20 时，先升级后再按以下命令运行。

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run web
```

网页端有独立的验证码与登录流程，不复用浏览器在学校网站的现有会话。登录请求由本站 `/school` 服务端路由转发给学校，学校会话保存在本站的 HttpOnly Cookie 中。成功登录后，教务网址、学号和密码使用服务端密钥加密，保存在网页脚本无法读取的 HttpOnly Cookie 中；之后只需填写验证码即可一键登录。用户可单独忘记保存的账号而保留离线课表，解绑则清除课表、会话和登录信息。服务端按学校页面的加载方式读取课程 JSON 和节次时间；学生已在网页反馈真实账号绑定成功。原生本地通知仍需要专用 iOS 构建。由于包含本地 Swift 模块，Expo Go 只能用于界面预览。

### 添加到 iPhone 主屏幕

1. 让 iPhone 与运行本项目的 Windows 电脑连接同一个 Wi-Fi，并保持电脑和 `npm run web -- --port 8087` 运行。
2. 在电脑运行 `ipconfig` 查看 WLAN 的 IPv4 地址。在 iPhone 的 Safari 输入 `http://<电脑IPv4地址>:8087/`；`localhost` 只能在电脑自身打开。
3. 在 Safari 点“分享”→“添加到主屏幕”，名称保留“课序”，再点“添加”。以后点主屏幕图标会直接打开课序的“今日”页。

这是局域网服务：电脑或开发服务器关闭后，图标会暂时无法打开；换网络或电脑 IP 变化时，旧图标地址也会失效。要在任何网络长期使用，必须把网页和 `/school` 服务端路由一起部署到稳定的 HTTPS 网址，不能只上传 `dist/client` 静态文件。当前局域网地址及学校入口均为 HTTP，账号、密码和会话可能被同一网络上的人截获；仅在可信网络下测试，不要在公共 Wi-Fi 上输入真实密码。

### 公网部署进展

EAS Hosting 免费计划提供 `*.expo.app` HTTPS 地址，**不需要自有域名、Mac 或 Apple 开发者会员**。项目已启用 `web.output: "server"`，部署时包含 `/school` API 路由。Expo 账号 `yingfeng`、项目 `@yingfeng/campus-timetable` 和 production 环境的敏感变量 `SCHOOL_SESSION_KEY` 已配置。

网页已导出并部署预览：[课序 EAS 预览](https://kexu-yingfeng--o7co6akyt9.expo.app/)。首页可打开，但云端访问学校登录页 `http://202.114.190.75/login` 返回 HTTP 403，导致验证码接口返回 502、无法绑定或同步。**此预览未推广为正式入口，不能代替当前可用的本机隧道。**本机请求同一学校入口为 200，说明还需寻找能够访问学校的云端运行环境。

```powershell
npx expo export --platform web
npx eas-cli@latest deploy --environment production
```

预览通过验证码与真实绑定测试后，才可在 Expo Hosting 页面将部署设为 production。后续更新需要重新导出和部署。当前已用 Cloudflare 临时隧道验证：iPhone 使用蜂窝数据时，课表能出现并同步；该地址仍依赖本机和隧道持续运行。EdgeOne Makers 提供包含 Node.js 云函数的长期免费套餐，但尚未注册和验证其云端能否访问学校，不能预先认定为可用方案。

HTTPS 只保护 iPhone 到托管服务的一段；托管服务到学校 `http://202.114.190.75` 仍为明文。网页仅在打开或前台使用时自动检查，不能保证关闭后实时更新。

```powershell
npm run export:ios
```

此命令检查 iOS JavaScript 资源是否能打包，输出 **不是可安装 IPA**。

## 无 Mac 的 iOS 安装路线

1. 注册自己的 Expo 账号及 Apple Developer Program 会员。
2. 把 `app.config.ts` 的 `com.example.campustimetable` 换成自己的唯一 Bundle ID。
3. 使用现有 Expo 项目，确认云端代码上传和签名凭据保管方式。
4. 用 EAS 在云端 Mac 构建。内部测试通常要登记设备；TestFlight 需要对应 App Store Connect 应用与分发流程。

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest device:create
npx eas-cli@latest build --platform ios --profile preview
```

`preview` 是可独立运行的内部测试构建；`development` 依赖开发服务器。目前只完成了网页预览部署；没有执行 iOS 原生构建、Apple 签名或付费操作。

## 学校 HTTP 入口与发布门槛

用户提供的入口为 `http://202.114.190.75/login`。目前没有验证官方 HTTPS 替代地址。测试构建在 `eas.json` 中显式设置 `ALLOW_SCHOOL_HTTP=true`，仅允许 WebKit 加载 HTTP；应用其他网络请求仍保留 ATS 限制。用户必须在绑定说明中自行确认后才打开学校页面。

网页端只连接这个已核实的学校地址。服务端校验教务网址，仅请求登录页、验证码、登录提交、本学期课表及该页面使用的课程 JSON 和节次时间接口；学校 Cookie 和保存的登录信息均被加密封装在仅限本站 `/school` 路径的 HttpOnly Cookie 中。HTTPS 部署需配置 `SCHOOL_SESSION_KEY` 并保持密钥不变；学校会话最长保留30天，保存的登录信息最长保留180天。学校会话到期后可使用保存账号和新验证码重新登录，离线课表不会因此清空。学校 HTTP 传输仍不安全；正式公网使用须确认学校授权与隐私要求。

绑定页只接受该学校已核实的登录网址。WebView 导航只允许该学校 origin 上已观察到的登录页、登录表单返回路径、首页与本学期课表路径，不允许打开选课、退课或第三方站点。此限制不能使 HTTP 传输变得安全，页面及资源仍可能受到网络篡改影响。

`production` 默认关闭 HTTP 接入。正式上线前必须确认学校官方 HTTPS 入口、允许的读取方式及隐私说明，并相应更新白名单和解析器。不应把开发测试配置直接当作已可公开发布的生产应用。

## 项目结构

| 路径                               | 内容                                       |
| ---------------------------------- | ------------------------------------------ |
| `src/app/`                         | Expo Router 原生界面路由                   |
| `src/app/school+api.ts`            | 网页验证码、登录、同步和解绑服务端路由     |
| `src/state.tsx`                    | 缓存、同步状态、复核和变更记录             |
| `src/core/model.ts`                | 严格数据校验、周次解析、课程比较、提醒时间 |
| `src/core/extractor.ts`            | 仅提取渲染课表 DOM 的 WebView 脚本         |
| `src/core/school-json.ts`          | 网页端学校课程 JSON 解析                  |
| `src/core/login.ts`                | 学校网址校验与一次性登录表单填充           |
| `src/components/Portal.native.tsx` | App 内学校页面与来源校验                   |
| `src/services/device.native.ts`    | 原生通知与会话清理调用                     |
| `modules/campus-session/`          | 清理本 App WebKit 存储的 Swift 本地模块    |
| `tests/`                           | 脱敏结构样例和核心回归测试                 |
| `eas.json`                         | 云端开发、内部测试、生产构建配置           |

## 后续接入全天候同步

首先与学校确认可持续使用的只读接口、授权有效期、访问频率与通知数据覆盖范围。随后实现服务端授权存储、任务调度、版本比较、推送与手机增量获取，再验证登录过期、离线和撤销课程等场景。当前没有常驻同步后台；网页绑定时账号和密码会先发往运行本站的服务器，服务器再向学校提交登录请求。

完整状态与限制见 [验证记录](docs/验证记录.md)。
