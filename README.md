# pagent-mobile

Pagent 的官方移动客户端（iOS / Android / 平板）。Expo + React Native + TypeScript，UI 参考 OpenMuse，代码全自研。

## 启动

```sh
# 1. 起服务端（另一个仓库，只读使用）：mock 模型，数据隔离在 .personal-bot/mock，端口 8788
cd ~/Desktop/code/personal-bot && pnpm dev:mock

# 2. 起客户端 Web 调试（端口固定 8082，避开 openmuse 的 8081）
cd ~/Desktop/code/pagent-mobile && npx expo start --web --port 8082
```

真机 / 模拟器：`npx expo start` 后按提示用 Expo Go 扫码（需要开发构建时再 `npx expo run:ios|android`）。

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
