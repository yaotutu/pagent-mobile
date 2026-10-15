# pagent-mobile — Pagent 移动客户端

pagent 的官方移动客户端（iOS / Android / 平板，Expo + React Native + TypeScript）。UI 参考 OpenMuse（`~/Desktop/code/openmuse/apps/mobile`），**代码全自研**：不 fork、不用 CopilotKit SDK。产品后续会有一期纯 Web 客户端（pagent-web），以本项目 UI 定稿为参照，本仓库不做 Web 版。

## 协同红线（先读这个，再读下面的 Expo 指南）

- **服务端仓库 `~/Desktop/code/personal-bot` 严格只读**。它由另一个 agent 维护；不修改它的任何文件、不做任何 git 操作。唯一允许的交互是运行 `pnpm dev:mock`（8788，mock 数据天然隔离在 `.personal-bot/mock`）做联调。
- **接口事实来源 = 服务端提供的 swagger 式 API 文档页面**。文档就绪前，从 personal-bot 源码只读提取：`src/http/app.ts`、`src/http/workspace-routes.ts`、`src/http/contracts/rest.ts`，以及 `web/src/lib/api.ts`（已验证的消费端实现，SSE 解析直接翻译它）。
- **遇到不合理的接口：停下来报告用户，由用户介入协调服务端修改**。绝不自行修改服务端，也不迁就别扭的接口硬写。发现的问题记录到 `docs/notes.md`。
- 服务端 agent 自己维护的测试 web 页面与本仓库无关，不关心、不维护、不评价。
- 添加详细中文注释，重点解释职责边界、协议契约和安全约束，不逐行复述代码。

## 技术决策（定稿，勿偏离）

- **无导航库**：tab 状态机 + Sheet 层（OpenMuse 同款模式），见下节。
- **SSE 消费**：`expo/fetch`（原生流式支持）+ 自研 AG-UI 事件解析/聚合，翻译 personal-bot 的 `web/src/lib/api.ts`（分帧）与 `web/src/chat/chat-state.ts`（StreamAggregator）。
- **工具卡**：自研 `Map<toolName, ToolRenderer>` 注册表 + `"*"` 通配兜底（借鉴 OpenMuse useRenderTool 形态）。
- **markdown**：react-native-markdown-display + 链接 http/https 协议白名单；无语法高亮。
- **状态管理**：useState/Context + 快照 3-5s 轮询，不引状态库。
- **视觉**：一切颜色/圆角/字号/布局常量从 `src/ui/tokens.ts` 取（值源自 OpenMuse ui.tsx），禁止组件里散写魔法值。
- Expo Web dev 端口固定 **8082**（避开 openmuse 的 8081）。

进度、阶段计划与页面规格见 `docs/HANDOFF.md`。

---

以下为 Expo 官方工程指南（模板自带，仍然适用）：

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- **本项目不使用 Expo Router / react-navigation**（pagent 技术决策）：4 个主 tab 用状态机切换（`View = chat | activity | goals | apps`），详情与弹层用自研 Sheet 组件（<600px 底部抽屉 / 桌面居中模态），与 OpenMuse 的 App.tsx 模式一致。
- 因此不存在 `src/app/` 路由目录；页面代码放 `src/chat/`、`src/activity/`、`src/goals/`、`src/apps/`。

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
