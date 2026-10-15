# pagent-mobile — Pagent 移动客户端

pagent 的官方移动客户端（iOS / Android / 平板，Expo + React Native + TypeScript）。UI 参考 OpenMuse（`~/Desktop/code/openmuse/apps/mobile`），**代码全自研**：不 fork、不用 CopilotKit SDK。产品后续会有一期纯 Web 客户端（pagent-web），以本项目 UI 定稿为参照，本仓库不做 Web 版。

## Subagent 委派与成本控制

- **默认主动委派简单任务**，无需逐次询问用户。主 Agent 负责理解需求、划定边界、分派、验收与最终汇报；边界明确后，不先亲自完成再让 Subagent 重做。
- 适合委派：指定文件的代码定位、文档更新、文案和样式微调、已定位原因的局部 Bug 修复、类型补充、少量针对性测试、截图视觉检查。任务应有明确输入、修改范围和验收标准，通常局限于 1–3 个文件。
- 主 Agent 保留：架构与产品决策、模糊需求澄清、复杂根因调查、跨模块协议变更、鉴权与安全边界设计，以及服务端接口协调。复杂任务中已经划清边界的简单部分仍可委派。
- 按职责选角色：只读定位用 `code-explorer`；局部实现用 `code-worker`；截图检查用 `visual-reviewer`；明确要求整理并本地提交时用 `code-maintainer`。角色不等于模型。
- **简单任务默认显式指定 `model="gpt-6-luna"`、`reasoning_effort="low"`、`fork_turns="none"`**，避免继承主 Agent 的高成本模型和整段历史。派单中补齐目标、相关文件、必要背景、项目红线和验收命令；视觉任务必须使用支持图像输入的可用模型。
- 当前环境无法使用指定模型时，说明限制并选择可用的轻量模型；不得静默改为高成本模型。轻量模型遇到超出范围的问题，先返回证据与阻塞点，由主 Agent 判断是否接手或提升模型，不反复盲试。
- 默认只启动 1 个 Subagent；存在互不依赖且不修改同一文件的任务时，最多并行 2 个。Subagent 不再递归委派；相关后续任务优先复用已有 Subagent。
- 派单必须明确文件所有权，提醒共享工作区中还有其他 Agent、不得覆盖或回滚他人修改，并要求返回简短的变更摘要、验证结果和未解决问题。所有 Subagent 同样遵守本文件的服务端只读、中文注释和技术决策。
- 主 Agent 依据返回的文件位置和 diff 做针对性验收，不重复完整探索或重写实现。代码修改完成后统一运行必要检查；最终验收仍包含本项目要求的 lint 和 typecheck。
- 单条命令、改一处拼写、直接回答问题等几乎没有执行成本的工作可由主 Agent 直接处理；本规则自身的一次性小修也可直接完成。以降低总消耗为准，不为凑委派次数拆碎任务，不为等待而做重复工作。

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

## CI/CD 与版本号管理（开发阶段）

本仓库当前未配置 GitHub Actions workflow，仅有本地 bump 脚本 + 规范说明。后续接 CI/CD 时按本节执行，**不要偏离**。

### 版本号规则（强约束）

- 三位字段同步 +1：`expo.version` patch +1（1.0.0 → 1.0.1）、`expo.android.versionCode` +1、`expo.ios.buildNumber` +1。开发阶段不引入 semver。
- **任何 agent / 开发者不得手动修改这三个字段**。`app.json` 其他字段随便改。
- 版本号只能由 `tools/bump-version.mjs` 写入；跑过一次就 +1，不做"上次 bump 没"的判断。

### bump 脚本

```sh
node tools/bump-version.mjs           # 写回 app.json
node tools/bump-version.mjs --check   # 只算不算，CI 守门用
```

stdout 输出 `version=X.Y.Z` / `versionCode=N` / `buildNumber=N`，CI 里 `>> "$GITHUB_OUTPUT"` 捕获。

### 后续接 CI/CD 时按这个做

- `release.yml`（push to main）：bump → `[skip ci]` 提交回 main → 触发 Android 构建 → `softprops/action-gh-release@v3` 创建 published Release。
- `ci.yml`（push/PR）：**必须包含 version-field 守卫**——检测 `app.json` 三个版本字段被改 → fail PR。这是规则不被打破的唯一手段。
- 仓库设置：main 走 branch protection 禁直接 push（`gh api repos/:owner/:repo/branches/main/protection`）；keystore 用 `gh secret set` 上传，文件不进仓库。

### agent 改 `app.json` 的边界

- `expo.name` / `expo.slug` / `expo.icon` / `plugins` / `expo.web` / `expo.android` 下非 `versionCode` 字段：随便改。
- `expo.version` / `expo.android.versionCode` / `expo.ios.buildNumber`：**禁止手动改**，跑 `tools/bump-version.mjs`。

### 当前不做

iOS 构建、OTA 自动更新、Play Store 自动上架。后期接 OTA 时再单独开规范。

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
