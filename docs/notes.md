# 接口问题记录

遇到不合理/不顺手的服务端接口：先在此登记（现状 / 期望形状 / 理由），然后**停下来报告用户**，由用户介入协调服务端 agent 修改。服务端契约更新后再继续。

| 日期 | 接口 | 现状 | 期望 | 状态 |
| --- | --- | --- | --- | --- |
| 2026-10-15 | GET /api/threads（及线程域整体） | 线程无标题字段（仅 `{id, updatedAt}`），且无重命名/删除端点；HANDOFF 会话 Sheet 规格含「重命名」，按现 API 无法实现，列表只能展示 threadId 原文 | 服务端补线程标题字段 + 重命名（可再加删除）端点；或确认移动端去掉重命名、直接展示 threadId | 待用户裁决 |
| 2026-10-15 | notifications.payload（GET /api/agent） | 类型为 `Record<string, string>`，键名未定义。审批卡需要知道键名（如 file_write→content、file_edit→before/after）才能友好渲染写入预览 | 文档明确各 kind 的 payload 键名枚举 | 待澄清；过渡期从 personal-bot 源码只读提取实际键名 |
| 2026-10-15 | tasks.plan / tasks.evidence（GET /api/agent、任务详情） | 元素结构未定义（`items: {}`），无法类型安全渲染 | 文档给出元素结构 | 低优先：任务详情已有 events 时间线（结构完整）可渲染，plan/evidence 可通用展示或不渲染 |
| 2026-10-15 | 全端点 CORS | OPTIONS 预检返回 204 并回 allow-methods/allow-headers，但**任何响应都不带 `Access-Control-Allow-Origin`**，浏览器跨域全被拦（原生 App 不受影响） | 跨域响应补 `Access-Control-Allow-Origin`（如回显 Origin 白名单） | 已告知用户；过渡期本仓库自带本地代理（tools/dev-proxy.mjs，8791→8788 注入 CORS 头）供 Web 调试，服务端修复后退役 |

## 本轮核对（2026-10-15）

- 已实际读取 `http://127.0.0.1:8790/openapi.json`：文档接口可用，会话仍只有 `id/updatedAt`，没有重命名端点；重命名继续等待协调。该文档实例与隔离 mock 8788 不同，不能据此宣称 mock 或真实模型已验收。
- **聊天卡审批关联待协调**：当前审批通知可含 threadId/runId，但没有 toolCallId；同一轮可能多次写同一路径，仅按路径或时间匹配会串错审批。期望通知增加 toolCallId，或 SSE 提供 notificationId 关联。客户端保留审批列表的准确状态，并增加聊天卡“查看审批”入口；不猜测每张工具卡的批准/拒绝状态。
- **结构化天气待协调**：`get_weather` 当前通过 SSE 只投影格式化文本，无法稳定取得温度、湿度、观测时间等结构化字段。期望在工具结果契约提供带版本的结构化数据；客户端暂提供天气专用文本卡，不用正则反向解析展示文案。

## 真实 mock 联调补充（2026-10-15）

- **已修复客户端旧契约适配**：以当前 8788/8790 OpenAPI 为准，聊天改为 `POST /api/conversation/run` 的 `{threadId,runId,expectedRevision,message}` 增量请求；历史保留 `{revision,messages}`；停止改为 `POST /api/conversation/stop` 并同时匹配两个 ID。任务 kind/target 使用 `job|task`，详情读取 `{task,events}`。`GET /api/agent` 不再含审批正文，由客户端并行读取 `/api/actions/pending` 后合成展示状态。本次登录中实际提交的最近决定只在客户端内存保留。
- **工具投影缺失，待服务端协调**：在隔离 mock 8788 新建会话 `mobile-tools-smoke-1792053047670`，发送「写入工具投影验收」，确认 `/api/actions/pending` 出现该会话的写入审批并通过决定端点拒绝（200）。实际 SSE 仅有 `RUN_STARTED/TEXT_MESSAGE_*/RUN_FINISHED`，没有 `TOOL_CALL_*`；随后权威历史也只有 user 与 assistant 文本，没有 toolCalls/tool 消息。浏览器批准与拒绝流程同样能执行，但聊天专用工具卡缺少可消费的事件与历史。期望工具执行时发出 AG-UI 工具事件，历史保留调用与结果投影。移动端不猜测助手回复来还原工具调用；前一轮固定数据卡片验收继续有效，真实工具卡全链路保持阻塞。本仓库未修改服务端。
