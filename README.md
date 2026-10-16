# pagent-mobile

Pagent 的官方移动客户端（iOS / Android / 平板）。Expo + React Native + TypeScript，UI 参考 OpenMuse，代码全自研。

## 离线体验界面

只运行 `npm run web`，在登录页点击 **体验演示工作区**，即可在不启动服务端的情况下体验四个页面。已连接服务时，也可从会话菜单进入演示。

- 顶部常驻「演示数据 · 不执行真实操作」，点击「管理演示」可重置为示例/空工作区，或退出。
- 聊天输入区上方的「尝试一个演示场景」提供搜索、天气、记忆、任务、监控、预览、审批、慢流和失败恢复。
- 所有修改仅存在内存，重置、退出或刷新后消失；演示不写服务凭证、不覆盖已有真实登录、不发真实 API 请求。演示任务详情可手动推进排队/运行/完成，审批不会写真实文件。
- 会话重命名/归档、完整演示审批记录与结构化天气目前仅在演示模式提供；真实模式仍以服务端已有接口为准，不伪造保存结果。

## 连接服务

Web 联调需要三个终端。服务端仓库只运行隔离 mock 服务，不修改其文件：

```sh
# 1. 启动服务端 mock（另一个仓库，只读使用；mock 数据隔离在 .personal-bot/mock，端口 8788）
cd ~/Desktop/code/personal-bot && pnpm dev:mock

# 2. 启动本地 Web 联调代理（8791 → 127.0.0.1:8788，并注入 CORS 响应头）
cd ~/Desktop/code/pagent-mobile && npm run proxy

# 3. 启动 Expo Web（固定端口 8082，避开 OpenMuse 的 8081）
cd ~/Desktop/code/pagent-mobile && npm run web
```

Web 默认通过 `http://localhost:8791` 访问代理。需要改 API 基址时可设置 `EXPO_PUBLIC_API_BASE_URL`，例如：

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:8791 npm run web
```

原生端默认访问 mock 服务 8788：Android 模拟器使用 `http://10.0.2.2:8788`，iOS 模拟器使用 `http://127.0.0.1:8788`。真机或其他服务地址通过 `EXPO_PUBLIC_API_BASE_URL` 指定为设备可访问的 URL。启动原生调试运行 `npx expo start`，需要开发构建时再运行 `npx expo run:ios` 或 `npx expo run:android`。

当前客户端已实现四个工作区、工具卡、审批入口和任务详情。2026-10-16 全量回归通过71项自动化测试、100条浏览器交互断言与Android API36 / Expo Go SDK57原生主要流程，并验证三平台生产JS/Hermes导出；iOS运行、正式包/真机及真实远程模型未验收，HTTP监控仍缺可控fixture，详见 `docs/HANDOFF.md`。

## 代码组织

- `App.tsx` → `src/app/AppRoot.tsx`：启动与 Provider 组装；`AppShell.tsx` 仅编排 tab、顶栏和全局弹层。
- `src/api/`：客户端契约、网络类型、HTTP 实现、SSE 分帧与注入点；页面不直接依赖 HTTP 实现。
- `src/auth/`、`src/threads/`、`src/workspace/`、`src/approvals/`：分别持有登录、会话列表、共享快照轮询和本次登录内的审批决定。
- `src/chat/`：`useConversation` 管理历史/revision/流式运行；`chat-state` 做纯事件聚合；页面与输入区、消息气泡负责交互和展示。
- `src/activity/`、`src/goals/`、`src/apps/`：按功能就近放置页面、卡片和表单，页面只保留编排与跨组件操作状态。
- `src/ui/`：无业务枚举的 UI 原语与设计 token；`src/shared/`：跨业务展示与格式化。
- `src/demo/`：隔离的内存演示客户端、素材和场景入口；不扩展真实服务端契约，不接入凭证存储。
- `tests/`：Node 测试，统一预加载 TypeScript 源码转译和 Expo fetch 测试边界；包括 HTTP 契约、聊天聚合、演示隔离与状态转换。真实分支联调继续使用服务端隔离 mock。

依赖方向为应用组装 → 功能模块 → API 契约 / UI；API 与 UI 不依赖页面或 Shell。切 tab 时聊天常驻，切会话时通过 `key={threadId}` 卸载旧流；退出登录整体销毁受保护的工作区状态。

## 常用命令

```sh
npm run typecheck   # 类型检查
npm run lint        # lint
npm test            # 协议、聚合与工作区纯状态回归
npx expo install X   # 装依赖（总是用它，解析 SDK 兼容版本）
npx expo-doctor      # 依赖/配置诊断
```

## 文档

- `docs/HANDOFF.md` — 交接文档：进度、阶段计划、页面规格、验收方式
- `AGENTS.md` — 协同红线与技术决策定稿（agent 接手必读）
- `docs/notes.md` — 接口问题记录（遇到不合理接口先记录并停下报告用户）
