# pagent-mobile

Pagent 的官方移动客户端（iOS / Android / 平板）。Expo + React Native + TypeScript，UI 参考 OpenMuse，代码全自研。

## 启动

Web 调试需要三个终端。服务端仓库只运行 mock 服务，不修改其文件：

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

当前客户端已实现四个工作区、专用工具卡、审批入口和任务结果折叠。本轮 mock 工作流与 Android 原生登录、SSE、键盘和安全区基础 smoke 已通过；Android 其他页面、真实工具投影和真实模型流程仍待验收，详见 `docs/HANDOFF.md`。

## 常用命令

```sh
npx tsc --noEmit     # 类型检查
npx expo lint        # lint
npx expo install X   # 装依赖（总是用它，解析 SDK 兼容版本）
npx expo-doctor      # 依赖/配置诊断
```

## 文档

- `docs/HANDOFF.md` — 交接文档：进度、阶段计划、页面规格、验收方式
- `AGENTS.md` — 协同红线与技术决策定稿（agent 接手必读）
- `docs/notes.md` — 接口问题记录（遇到不合理接口先记录并停下报告用户）
