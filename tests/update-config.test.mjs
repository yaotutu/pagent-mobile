import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

test('Android自更新声明系统安装权限且保持已发布包名', () => {
  assert.equal(config.android.package, 'com.yaotutu.pimusemobile');
  assert.ok(config.android.permissions.includes('android.permission.REQUEST_INSTALL_PACKAGES'));
});

test('原生正式包明确允许用户已选择的HTTP服务器，而非仅ExpoGo可用', () => {
  const plugin = config.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-build-properties');
  assert.equal(plugin?.[1]?.android?.usesCleartextTraffic, true);
});
