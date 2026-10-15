# pagent-mobile 交接文档

> 2026-10-15 由初始化会话写就。接手的 agent 从"下一步"继续，不必重做已完成项。

## 这是什么

pagent 的官方移动客户端（iOS / Android / 平板）。Expo SDK 57 + React 19.2 + RN 0.86 + TypeScript strict，UI 参考 OpenMuse（`~/Desktop/code/openmuse/apps/mobile`），代码全自研、不 fork、不用 CopilotKit SDK。产品规划里本仓库 UI 定稿后还会有一期纯 Web 客户端（pagent-web，以本项目为参照），**本仓库不做 Web 版**。

## 协同协议（详见 AGENTS.md，此处摘要）

- 服务端仓库 `~/Desktop/code/personal-bot` 由另一个 agent 维护，**本仓库对它严格只读**（唯一允许：跑 `pnpm dev:mock` 联调，8788）。
- 接口事实来源 = 服务端将提供的 swagger 式 API 文档页面。**文档页面尚未就绪**，过渡期从 personal-bot 源码只读提取：`src/http/app.ts`、`src/http/workspace-routes.ts`、`src/http/contracts/rest.ts`（zod 契约）、`web/src/lib/api.ts`（已验证的消费端实现，SSE 解析逻辑直接翻译它）。
- **遇到不合理接口 → 停下来报告用户，用户介入协调服务端**。不自行改服务端，不迁就硬写。问题记录进 `docs/notes.md`。
- 服务端自己的测试 web 页面与我们无关。

## 已完成（初始化）

- Expo 脚手架（blank-typescript 模板），`app.json` 显示名 Pagent、`ios.supportsTablet: true`、light 模式。
- 依赖齐备：react-dom / react-native-web（Web 调试）、lucide-react-native + react-native-svg（图标）、react-native-markdown-display（markdown）、zod（工具结果校验）。
- `src/ui/tokens.ts`：设计 token 落地（OpenMuse 值）——颜色（canvas #FCFCFC、ink #11191C、muted #697176、line #EEEEF0、bubbleUser #C8E7FF、accent #1473C8、success #47896C、danger #AA4A45 等）、圆角（card 23 / sheet 26 / bubble 22 尾角 7 / pill 32 / tab 40）、字号阶梯、布局常量（contentMaxWidth 760 / tab 370 / 断点 900、600）。**组件里禁止散写这些值**。
- 目录骨架：`src/{ui,lib,chat,activity,goals,apps}`。
- `App.tsx` 为占位屏（验证 token），将被正式骨架替换。
- `.npmrc` 用 npmmirror 镜像（本机直连 registry.npmjs.org 不通）。
- AGENTS.md / README.md / 本文档 / docs/notes.md。

## 技术决策（定稿，勿偏离）

- 无导航库：4 tab 状态机（`View = chat | activity | goals | apps`）+ Sheet 层（<600px 底部抽屉带抓手条 / 桌面居中模态）。
- SSE：`expo/fetch` + 自研 AG-UI 事件解析/聚合。翻译源：personal-bot `web/src/lib/api.ts`（fetch POST + ReadableStream 按 `\n\n` 分帧解析 `data:` 行）与 `web/src/chat/chat-state.ts`（StreamAggregator：TEXT_MESSAGE_*、TOOL_CALL_START/ARGS/END、TOOL_CALL_RESULT、MESSAGES_SNAPSHOT、RUN_ERROR）。
- 工具卡：自研 `Map<toolName, ToolRenderer>` + `"*"` 通配兜底。
- markdown：react-native-markdown-display + 链接 http/https 协议白名单；无语法高亮。
- 状态：useState/Context + `/api/agent` 快照 3-5s 轮询；不引状态库。

## 页面规格（4 tab + 顶栏）

- **底部悬浮 pill tab bar**：白胶囊（maxWidth 370、圆角 40、软阴影）居中固定底部；选中块灰底（tabActive）圆角 28；lucide 图标 23px strokeWidth 1.8。tab = 聊天 / 任务 / 目标 / 应用。
- **顶栏**：左汉堡（开"会话 Sheet"：主会话 / side chats / 新建 / 重命名，参照 OpenMuse ThreadsSheet）；中 agent 名（identity.name）+ 一行动态状态（就绪 / 思考中… / N 项待审批）；右铃铛（pendingActions > 0 显示未读小点，点开审批 Sheet：write/edit 的 approve/deny）。
- **聊天页**：用户浅蓝气泡右对齐 maxWidth 85%、右下角收 7；助手灰气泡左对齐 maxWidth 95%、左下角收 7；含工具调用的消息占 95%。流式三点指示（透明度 0.4/0.75/0.5 装入 28 圆角灰胶囊）。输入区白色 pill（圆角 32、聚焦描边 #C7E4F9 + 阴影加深、textarea 高 44→140 自适应、Web 态 Enter 发送 Shift+Enter 换行）、右侧 44×44 圆形发送(↑)/停止(■)同位切换。智能滚动：距底 <100px 才跟随，脱离后悬浮"回到最新"按钮。空态大标题 + 3 个建议 prompt。运行结束拉 `GET /api/conversation` 用权威历史替换聚合视图（翻译 web/ 的既有做法，失败保留聚合视图）。
- **任务页（activity）**：定时 + 后台任务混合列表（状态徽章、结果/错误折叠、暂停/恢复/取消/重试）+ **监控区块**（monitors 列表 + 暂停/恢复/停止；创建走聊天 `monitor` 工具，页面放引导提示）。
- **目标页**：目标 CRUD + 里程碑勾选 + 进度条（参照 personal-bot `web/src/goals/GoalsView.tsx` 的交互，换新视觉）。
- **应用页（apps）**：身份卡（名字输入 + tone 三选一 chips：warm/concise/thoughtful）+ 记忆卡（行内编辑 / 忘记 / 新增，显示来源与时间戳）+ SOUL/USER 折叠编辑区（等宽字体）。
- **工具卡清单**（专用 renderer，其余走通配卡）：search_web（来源链接列表）、memory（保存成功 + 跳应用）、schedule / monitor（保存成功 + 跳任务）、delegate_task（任务状态 + 跳任务）、get_weather（结构化）、write / edit（审批态：等待批准 / 已批准 / 已拒绝）、read / grep / find / ls / web_fetch（文件或网页预览，截断 + 展开）、currentTime（轻量单行）。

## 服务端接口速览（过渡期从源码提取，以未来 API 文档页为准）

- 鉴权：`POST /api/session`（body 可带 accessKey）→ `{token}`；其余请求带 `Authorization: Bearer <token>`；401 清 token 重登录。
- 会话与历史：`GET /api/threads`、`GET /api/conversation?threadId=`。
- AG-UI 流：`POST /api/copilotkit/agent/default/run`（SSE：RUN_STARTED / TEXT_MESSAGE_* / TOOL_CALL_* / RUN_FINISHED / RUN_ERROR）；停止 `POST /api/copilotkit/agent/default/stop/:threadId`。
- 快照：`GET /api/agent`（tasks 混合 kind=monitor|agent、goals、monitors、memories、identity、notifications）。
- 操作：`POST /api/agent/tasks`、`POST /api/agent/tasks/:id/control`（pause/resume/cancel/retry，target=job|task）、`POST /api/agent/monitors/:id/control`（pause/resume/stop）、`POST /api/actions/:id/decide`（approve/deny）。
- goals 五端点、memories 三端点、`POST /api/agent/identity`、`GET|PUT /api/profile`（SOUL/USER）。
- **注意**：monitors 相关服务端代码在 personal-bot 工作区尚未提交（另一 agent 的进行中工作），API 已可用；我们只消费不催促。

## 下一步（按序，每步 Expo Web 8082 + dev:mock 8788 验收）

1. `src/ui/components.tsx` 原语库：Button（primary=bubbleUser 底 / secondary=subtle / danger）、IconButton（44×44 圆）、Card、Chip、Field、Empty、ErrorNotice、SectionHeading（label 样式全大写）、StatusBadge、LinkRow（图标+双行+Chevron）、IconBox（36×36 圆角 13）、Sheet（双形态）。对照 OpenMuse `apps/mobile/src/ui.tsx`。
2. 正式 App 骨架替换占位屏：登录门（POST /api/session，token 存 expo-secure-store）→ tab 状态机 + 顶栏 + 底部 pill bar + Sheet 层。
3. 聊天主链路：lib/api.ts（fetch 封装 + expo/fetch SSE 解析 + StreamAggregator 翻译）→ 会话 Sheet → 气泡/markdown/流式指示 → 工具卡注册表 + 通配卡 → 输入区 → 审批卡。
4. 工作台三页：任务+监控、目标、应用 + 铃铛审批 Sheet。
5. Android 模拟器 smoke：原生 SSE 消费、键盘避让、安全区（**必须做**——Web 调试验证不了 RN 原生 fetch 流式差异；iOS/真机延期）。
6. 真实服务端 + 真实模型验收：聊天流式、工具卡、审批、监控创建全路径。

每步验收 = `npx tsc --noEmit` 通过 + Expo Web 页面浏览器人工检查（含 375px 视口与错误态）。

## 明确不做

纯 Web 客户端（另期）、CopilotKit SDK、修改服务端、暗色模式、语法高亮、消息队列、多会话保挂载、连接器（mail/browser/桌面）、iOS 真机/推送/后台断线。
