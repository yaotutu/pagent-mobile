#!/usr/bin/env node
/**
 * 递增 app.json 里的版本号（无条件自增，每次跑都 +1）。
 *
 * 同时 bump 三个字段（保持 app.json 自洽）：
 *   - expo.version             patch +1（1.0.0 → 1.0.1）
 *   - expo.android.versionCode +1
 *   - expo.ios.buildNumber     +1
 *
 * 为什么无条件：开发阶段不引入 semver，每次构建 +1 即满足需求。
 * 不做"上次 bump 没"的判断，避免 CI 重跑、并发、漏触发导致不一致。
 *
 * 用法：
 *   node tools/bump-version.mjs              真正写回 app.json
 *   node tools/bump-version.mjs --check      只算出新值并打印，不写（供 CI 守门用）
 *
 * 输出：把新版本号以 key=value 形式打印到 stdout：
 *   version=1.0.1
 *   versionCode=2
 *   buildNumber=2
 * CI 里用 `>> "$GITHUB_OUTPUT"` 捕获即可。
 *
 * 退出码：成功 0，失败 1。失败原因打到 stderr。
 */

import fs from 'node:fs';
import path from 'node:path';

const APP_JSON = path.resolve('app.json');
const CHECK_ONLY = process.argv.includes('--check');

function fail(msg) {
  console.error(`bump-version: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(APP_JSON)) {
  fail(`找不到 ${APP_JSON}，请在仓库根目录跑这个脚本`);
}

const cfg = JSON.parse(fs.readFileSync(APP_JSON, 'utf-8'));
if (!cfg.expo) {
  fail('app.json 里没有 expo 字段，结构不对');
}

const [major = 0, minor = 0, patch = 0] = String(cfg.expo.version ?? '0.0.0')
  .split('.')
  .map((n) => Number(n) || 0);
const newVersion = `${major}.${minor}.${patch + 1}`;
const newVersionCode = Number(cfg.expo.android?.versionCode ?? 0) + 1;
const newBuildNumber = String(Number(cfg.expo.ios?.buildNumber ?? 0) + 1);

console.log(`version=${newVersion}`);
console.log(`versionCode=${newVersionCode}`);
console.log(`buildNumber=${newBuildNumber}`);

if (CHECK_ONLY) {
  console.error(`bump-version: --check 模式，未写入 ${APP_JSON}`);
  process.exit(0);
}

cfg.expo.version = newVersion;
cfg.expo.android = { ...(cfg.expo.android ?? {}), versionCode: newVersionCode };
cfg.expo.ios = { ...(cfg.expo.ios ?? {}), buildNumber: newBuildNumber };

fs.writeFileSync(APP_JSON, JSON.stringify(cfg, null, 2) + '\n');

console.error(
  `bump-version: 已更新 ${path.relative(process.cwd(), APP_JSON)} ` +
    `(version ${major}.${minor}.${patch} → ${newVersion})`,
);
