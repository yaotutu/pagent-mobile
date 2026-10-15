# pagent-mobile 交接文档

> 2026-10-15 更新。本轮按当前 mock/OpenAPI 契约完成 HTTP 适配和多项 Web/Android 冒烟；仍有服务端工具投影及部分平台验收待处理。

## 这是什么

pagent 的官方移动客户端（iOS / Android / 平板）。Expo SDK 57 + React 19.2 + RN 0.86 + TypeScript strict，UI 参考 OpenMuse（`~/Desktop/code/openmuse/apps/mobile`），代码全自研、不 fork、不用 CopilotKit SDK。产品规划里本仓库 UI 定稿后还会有一期纯 Web 客户端（pagent-web，以本项目为参照），**本仓库不做 Web 版**。

## 协同协议（详见 AGENTS.md，此处摘要）

- 服务端仓库 `~/Desktop/code/personal-bot` 由另一个 agent 维护，**本仓库对它严格只读**（唯一允许：跑 `pnpm dev:mock` 联调，8788）。
- 接口事实来源 = 服务端 OpenAPI 文档。本轮已通过 `curl` 实际读取 `http://127.0.0.1:8790/openapi.json`；它与客户端本地 mock 8788 是不同服务实例。服务端仓库只读，不做任何修改或 Git 操作。
- **遇到不合理接口 → 停下来报告用户，用户介入协调服务端**。不自行改服务端，不迁就硬写。问题记录进 `docs/notes.md`。
- 服务端自己的测试 web 页面与我们无关。

## 当前实现与验收状态

登录门与凭证存储、四个 tab、聊天/任务/目标/应用页面、HTTP 与内存 mock 客户端、快照轮询、Web 联调代理均已实现。当前适配以隔离 mock 8788 的实际 OpenAPI 为准；服务端 OpenAPI 8790 是另一服务实例。

- Web mock 已验证：目标新增/编辑、勾选里程碑、暂停/恢复/完成；记忆新增/编辑；后台任务创建并完成、打开详情时间线；通过聊天创建定时任务并暂停/恢复/停止；慢流精确停止后可继续下一轮；revision 冲突返回 409 并提示重新加载；写入审批批准/拒绝及关闭后重开历史可见。宽屏及 375×812 浏览器均查看过工具预览、记忆/任务跳转、返回聊天保留消息、文件预览展开、审批入口状态和任务结果折叠。
- 目标删除确认弹层已打开并取消，未执行永久删除。身份改名保存后顶栏正确更新，随后主动改回原名并保存；人设保存后整页重载确认内容仍在，随后主动还原为原空值。以上还原是清理测试设置，并非持久化故障。监控创建/控制没有本轮实际验证证据。
- mock 实际审批动作成功，但 SSE 没有 `TOOL_CALL_*`，权威历史也没有工具调用/结果投影。因此真实 mock 聊天不能验证工具卡链路；工具卡展示、跳转和预览此前以临时固定数据 fixture 检查，不能当作真实工具结果验证。服务端协调事项见 `docs/notes.md`。
- 后台任务 fail-once 失败后重试并达到 succeeded、运行中任务取消并达到 cancelled 均已实测；慢流精确停止后下一轮仍可聊天。
- Android API 36 Pixel 7 模拟器在 Expo Go 57.0.9 上已登录，并通过原生 `expo/fetch` 消费 mock SSE，发送 `native-smoke-success` 后收到回复。已核对流式增量、思考中/停止/完成状态；键盘显示时输入区与完整底栏在键盘上方，安全区正常。Android 登录、流式、键盘与安全区基础 smoke 通过；强制关闭 Expo Go 后重新打开，可恢复 SecureStore 凭证并直接进入工作台。其他页面的原生完整验收未做。
- 共 28 项测试，28/28 通过；typecheck 通过；lint 通过且无警告。真实模型、真实工具投影、监控创建/控制全路径和永久删除尚未验收或执行。
- 服务端契约仍阻塞：线程只有 `id/updatedAt` 且没有重命名端点；审批通知缺少 `toolCallId`，不能安全关联具体工具调用与决定；天气结果只有格式化文本，没有结构化数据。当前提供会话 ID 展示、审批列表及查看入口、天气专用文本卡，不声称这些受阻能力已完整实现。
- 初始化脚手架、依赖、目录和下文产品规格仍有效；`App.tsx` 已是正式入口，不再是占位屏。

## 技术决策（定稿，勿偏离）

- 无导航库：4 tab 状态机（`View = chat | activity | goals | apps`）+ Sheet 层（<600px 底部抽屉带抓手条 / 桌面居中模态）。
- SSE：`expo/fetch` + 自研 AG-UI 事件解析/聚合。当前增量请求为 `POST /api/conversation/run`，分帧解析 `data:` 行；mock 已验证文本事件与精确停止。AG-UI 聚合器保留工具事件支持，但当前 mock 没发出工具事件，故工具卡无法通过真实 mock 对话验收。
- 工具卡：自研 `Map<toolName, ToolRenderer>` + `"*"` 通配兜底。
- markdown：react-native-markdown-display + 链接 http/https 协议白名单；无语法高亮。
- 状态：useState/Context + `/api/agent` 工作区快照和 `/api/actions/pending` 审批列表并发轮询后合成客户端视图；不引状态库。审批决定仅在本次登录内存中保留，关闭再开 Sheet 可见，重启后无服务端审批历史接口可恢复。

## 页面规格（4 tab + 顶栏）

- **底部悬浮 pill tab bar**：白胶囊（maxWidth 370、圆角 40、软阴影）居中固定底部；选中块灰底（tabActive）圆角 28；lucide 图标 23px strokeWidth 1.8。tab = 聊天 / 任务 / 目标 / 应用。
- **顶栏**：左汉堡（开"会话 Sheet"：主会话 / side chats / 新建 / 重命名，参照 OpenMuse ThreadsSheet）；中 agent 名（identity.name）+ 一行动态状态（就绪 / 思考中… / N 项待审批）；右铃铛（pendingActions > 0 显示未读小点，点开审批 Sheet：write/edit 的 approve/deny）。
- **聊天页**：用户浅蓝气泡右对齐 maxWidth 85%、右下角收 7；助手灰气泡左对齐 maxWidth 95%、左下角收 7；含工具调用的消息占 95%。流式三点指示（透明度 0.4/0.75/0.5 装入 28 圆角灰胶囊）。输入区白色 pill（圆角 32、聚焦描边 #C7E4F9 + 阴影加深、textarea 高 44→140 自适应、Web 态 Enter 发送 Shift+Enter 换行）、右侧 44×44 圆形发送(↑)/停止(■)同位切换。智能滚动：距底 <100px 才跟随，脱离后悬浮"回到最新"按钮。空态大标题 + 3 个建议 prompt。运行结束拉 `GET /api/conversation` 用权威历史替换聚合视图（翻译 web/ 的既有做法，失败保留聚合视图）。
- **任务页（activity）**：定时 + 后台任务混合列表（状态徽章、结果/错误折叠、暂停/恢复/取消/重试）+ **监控区块**（monitors 列表 + 暂停/恢复/停止；创建走聊天 `monitor` 工具，页面放引导提示）。
- **目标页**：目标 CRUD + 里程碑勾选 + 进度条（参照 personal-bot `web/src/goals/GoalsView.tsx` 的交互，换新视觉）。
- **应用页（apps）**：身份卡（名字输入 + tone 三选一 chips：warm/concise/thoughtful）+ 记忆卡（行内编辑 / 忘记 / 新增，显示来源与时间戳）+ SOUL/USER 折叠编辑区（等宽字体）。
- **工具卡清单**（专用 renderer，其余走通配卡）：search_web（来源链接列表）、memory（保存成功 + 跳应用）、schedule / monitor（保存成功 + 跳任务）、delegate_task（任务状态 + 跳任务）、get_weather（专用文本卡；结构化数据受服务端契约阻塞）、write / edit（展示工具结果并提供查看审批入口；具体审批决定仅在审批列表准确呈现，不按工具调用猜测）、read / grep / find / ls / web_fetch（文件或网页预览，截断 + 展开）、currentTime（轻量单行）。

## 服务端接口速览（以已实读 OpenAPI 文档为准）

- 鉴权：`POST /api/session`（body 可带 accessKey）→ `{token}`；其余请求带 `Authorization: Bearer <token>`；401 清 token 重登录。
- 会话与历史：`GET /api/threads`；`GET /api/conversation?threadId=` 返回 `{revision,messages}`。
- 增量聊天：`POST /api/conversation/run`，body 为 `{threadId,runId,expectedRevision,message:{id,content}}`；版本冲突返回 409。停止：`POST /api/conversation/stop`，body 为 `{threadId,runId}`，只停止匹配的运行。
- 快照：`GET /api/agent` 返回工作区数据，task kind 为 `job|task`，不含 notifications；客户端并行请求 `GET /api/actions/pending` 并合成审批视图。
- 任务：`POST /api/agent/tasks`；详情 `GET /api/agent/tasks/:id` 返回 `{task,events}`；控制 `POST /api/agent/tasks/:id/control`，action 为 pause/resume/cancel/retry，`target=job|task` 必填。监控控制：`POST /api/agent/monitors/:id/control`（pause/resume/stop）。
- 审批决定：`POST /api/actions/:id/decide`（approve/deny）。最近决定只在本次登录期间本地保存，服务端没有可供重启恢复的历史列表。
- goals 五端点、memories 三端点、`POST /api/agent/identity`、`GET|PUT /api/profile`（SOUL/USER）。
- **端口注意**：本地 Web 代理监听 8791，默认转发到 127.0.0.1:8788（mock）；服务端 OpenAPI 本轮通过 127.0.0.1:8790/openapi.json 实际读取。端口不同，对应不同服务。
- Web 调试由本地代理注入 CORS 响应头；这不表示服务端 CORS 已修复。线程重命名、审批与具体工具调用关联、结构化天气仍需服务端协调，详见 `docs/notes.md`。

## 下一步验收

1. 补做监控创建/控制实际联调，以及尚未覆盖的工作区 Web 页面流程；Android 其他页面尚未做原生完整验收。
2. 待服务端协调线程重命名、审批决定与 toolCall 的关联字段、工具事件/历史投影、天气结构化结果；真实模型全路径另行验收。

本轮 `npx expo lint`（无警告）、`npx tsc --noEmit` 与 28 项测试均已通过。目标永久删除未执行；不要将 mock 或 fixture 检查描述为真实模型或端到端工具验收。

## 明确不做

纯 Web 客户端（另期）、CopilotKit SDK、修改服务端、暗色模式、语法高亮、消息队列、多会话保挂载、连接器（mail/browser/桌面）、iOS 真机/推送/后台断线。
