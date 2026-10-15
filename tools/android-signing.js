#!/usr/bin/env node
/**
 * 配置 Android release 签名（CNG 模式专用）。
 *
 * 跑在 `npx expo prebuild --platform android` 之后、`./gradlew assembleRelease` 之前。
 * 修改的是 prebuild 出的临时 android/ 目录（在仓库 .gitignore 里忽略，不进 git）。
 *
 * 依赖环境变量（GitHub Actions 从 secrets 注入；本地用 `export VAR=value` 即可）：
 *   ANDROID_KEYSTORE_BASE64    base64 编码的 keystore 文件
 *   ANDROID_KEYSTORE_PASSWORD  keystore store 密码
 *   ANDROID_KEY_ALIAS          key 别名
 *   ANDROID_KEY_PASSWORD       key 密码
 *
 * 副作用：
 *   - 写入 android/app/release.keystore（解码自 base64）
 *   - 写入 android/key.properties
 *   - 修改 android/app/build.gradle：
 *     1. 在 signingConfigs 里追加 release 子块（从 key.properties 读取）
 *     2. 把 buildTypes.release.signingConfig 改成 signingConfigs.release
 *
 * 幂等：跑多次结果一致（已有 release 子块、签名已切换都跳过）。
 */

import fs from 'node:fs';
import path from 'node:path';

const ANDROID = path.resolve('android');
const APP = path.join(ANDROID, 'app');
const KEYSTORE = path.join(APP, 'release.keystore');
const KEY_PROPS = path.join(ANDROID, 'key.properties');
const BUILD_GRADLE = path.join(APP, 'build.gradle');

function fail(msg) {
  console.error(`android-signing: ${msg}`);
  process.exit(1);
}
function requireEnv(name) {
  const v = process.env[name];
  if (!v) fail(`缺少环境变量 ${name}`);
  return v;
}

if (!fs.existsSync(BUILD_GRADLE)) {
  fail('android/app/build.gradle 不存在，请先跑 `npx expo prebuild --platform android`');
}

const keystoreB64 = requireEnv('ANDROID_KEYSTORE_BASE64');
const storePass = requireEnv('ANDROID_KEYSTORE_PASSWORD');
const keyAlias = requireEnv('ANDROID_KEY_ALIAS');
const keyPass = requireEnv('ANDROID_KEY_PASSWORD');

// 1) 解码 keystore 到 android/app/release.keystore
fs.writeFileSync(KEYSTORE, Buffer.from(keystoreB64, 'base64'));
console.log(`android-signing: 写入 ${path.relative(process.cwd(), KEYSTORE)}`);

// 2) 写 android/key.properties（storeFile 用相对 android/ 的路径）
const relStoreFile = path.relative(ANDROID, KEYSTORE); // → "app/release.keystore"
const keyPropsContent =
  `storeFile=${relStoreFile}\n` +
  `storePassword=${storePass}\n` +
  `keyAlias=${keyAlias}\n` +
  `keyPassword=${keyPass}\n`;
fs.writeFileSync(KEY_PROPS, keyPropsContent);
console.log(`android-signing: 写入 ${path.relative(process.cwd(), KEY_PROPS)}`);

// 3) 修改 android/app/build.gradle
let bg = fs.readFileSync(BUILD_GRADLE, 'utf-8');

// 3a) 在 signingConfigs 块里追加 release 子块（如果还没有）
const releaseSigningBlock = `        release {
            def keystorePropertiesFile = rootProject.file("key.properties")
            def keystoreProperties = new Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }`;

// 用我们注入的锚点字符串作为唯一特征判断（避免被 buildTypes.release 误判 / 重复插入）
const SIGNATURE = 'def keystorePropertiesFile = rootProject.file("key.properties")';
if (bg.includes(SIGNATURE)) {
  console.log('android-signing: signingConfigs.release 已存在，跳过追加');
} else {
  const debugAnchor = /signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\}/;
  if (!debugAnchor.test(bg)) {
    fail('build.gradle 里找不到 signingConfigs.debug 块，结构不符合预期');
  }
  bg = bg.replace(debugAnchor, (m) => `${m}\n${releaseSigningBlock}`);
  console.log('android-signing: signingConfigs 里追加 release 子块');
}

// 3b) buildTypes.release.signingConfig 改为 signingConfigs.release
// 找包含 proguardFiles/minifyEnabled/shrinkResources 的 release 块（这是 buildTypes.release 的特征）
const allReleaseBlocks = [...bg.matchAll(/\brelease\s*\{[\s\S]*?\n\s*\}/g)].map((m) => m[0]);
const buildTypesRelease = allReleaseBlocks.find((b) =>
  /proguardFiles|minifyEnabled|shrinkResources/.test(b),
);
if (!buildTypesRelease) {
  fail('找不到 buildTypes.release 块（结构不符合预期）');
}

if (/signingConfig\s+signingConfigs\.debug/.test(buildTypesRelease)) {
  const newBlock = buildTypesRelease.replace(
    /signingConfig\s+signingConfigs\.debug/,
    'signingConfig signingConfigs.release',
  );
  bg = bg.replace(buildTypesRelease, newBlock);
  console.log('android-signing: buildTypes.release.signingConfig → signingConfigs.release');
} else {
  console.log('android-signing: buildTypes.release.signingConfig 已是 release，跳过');
}

fs.writeFileSync(BUILD_GRADLE, bg);
console.log('android-signing: 全部配置完成');
