import './register-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTO_CHECK_INTERVAL_MS, UpdateManager } from '../src/update/update-manager.ts';

const release = { id: 1, assetId: 20, version: '1.0.9', size: 100, url: 'https://github.com/yaotutu/pagent-mobile/releases/download/v1.0.9/app-release.apk' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(setImmediate);
function fixture(options = {}) {
  const calls = []; const control = { time: 0, exists: true, latest: release, check: undefined, download: undefined, install: undefined, settings: undefined };
  const manager = new UpdateManager({
    currentVersion: '1.0.8', supported: true,
    getLatestRelease: async (signal) => { calls.push(['check', signal]); return control.check ? control.check(signal) : control.latest; },
    download: async (value, signal, progress, force) => { calls.push(['download', value, force]); if (control.download) return control.download(signal, progress); progress(100, 100); return 'file:///app-updates/20.apk'; },
    fileExists: () => control.exists,
    install: async (uri) => { calls.push(['install', uri]); if (control.install) await control.install(); },
    openInstallSettings: async () => { calls.push(['settings']); if (control.settings) await control.settings(); },
    now: () => control.time,
    ...options,
  });
  return { manager, calls, control, count: (name) => calls.filter(([kind]) => kind === name).length };
}

test('Android新版自动检测、下载并直接唤起安装器，不把返回当升级成功', async () => {
  const f = fixture(); await f.manager.start(); await flush();
  assert.deepEqual(f.calls.map(([kind]) => kind), ['check', 'download', 'install']);
  assert.equal(f.manager.getSnapshot().status, 'ready');
  assert.equal(f.manager.getSnapshot().installAttempted, true);
  assert.equal(f.manager.getSnapshot().currentVersion, '1.0.8');
  assert.equal(f.manager.getSnapshot().noticeVersion, 1);
});

test('非Android独立包或读不到本机版本不发更新请求', async () => {
  for (const options of [{ supported: false }, { currentVersion: null }]) {
    const f = fixture(options); await f.manager.start(); await f.manager.check(); await f.manager.retryDownload();
    assert.equal(f.manager.getSnapshot().status, 'unsupported'); assert.deepEqual(f.calls, []);
  }
});

test('同版或旧版本只读检查，不能下载或降级', async () => {
  for (const version of ['1.0.8', '1.0.7']) {
    const f = fixture(); f.control.latest = { ...release, version }; await f.manager.start();
    assert.equal(f.manager.getSnapshot().status, 'current'); assert.equal(f.count('download'), 0);
  }
});

test('检查错误可手动重试，不进入下载/安装', async () => {
  const f = fixture(); f.control.check = async () => { throw Error('GitHub offline'); }; await f.manager.start();
  assert.equal(f.manager.getSnapshot().status, 'error'); assert.equal(f.manager.getSnapshot().errorStage, 'check');
  assert.equal(f.count('download'), 0);
  f.control.check = undefined; f.control.latest = { ...release, version: '1.0.8' }; await f.manager.check();
  assert.equal(f.manager.getSnapshot().status, 'current');
});

test('重复检查合并为同一任务，不并发下载/安装', async () => {
  const f = fixture(); const gate = deferred(); f.control.check = () => gate.promise;
  const first = f.manager.check(); const second = f.manager.check(); assert.equal(first, second);
  await flush(); assert.equal(f.count('check'), 1); gate.resolve(release); await first; await flush();
  assert.equal(f.count('download'), 1); assert.equal(f.count('install'), 1);
});

test('下载可报告未知总量进度，失败后显式重试强制重新下载', async () => {
  const f = fixture(); f.control.download = async (_signal, progress) => { progress(31); throw Error('network down'); };
  await f.manager.start(); assert.equal(f.manager.getSnapshot().errorStage, 'download');
  assert.equal(f.manager.getSnapshot().bytesWritten, 31); assert.equal(f.manager.getSnapshot().totalBytes, undefined);
  assert.equal(f.count('install'), 0); f.control.download = undefined;
  await f.manager.retryDownload(); await flush(); assert.equal(f.count('install'), 1);
  assert.equal(f.calls.filter(([kind]) => kind === 'download').at(-1)[2], true);
});

test('取消检查忽略迟到版本，不能自动下载', async () => {
  const f = fixture(); const gate = deferred(); f.control.check = () => gate.promise;
  const pending = f.manager.start(); await flush(); f.manager.cancel(); gate.resolve(release); await pending; await flush();
  assert.equal(f.manager.getSnapshot().status, 'cancelled'); assert.equal(f.manager.getSnapshot().busy, false);
  assert.equal(f.count('download'), 0); assert.equal(f.count('install'), 0);
});

test('取消下载忽略迟到进度和文件，自动检查不再次下载同一版本', async () => {
  const f = fixture(); const gate = deferred(); let progress;
  f.control.download = async (_signal, callback) => { progress = callback; return gate.promise; };
  const pending = f.manager.start(); await flush(); progress(10, 100); f.manager.cancel(); progress(90, 100);
  assert.equal(f.manager.getSnapshot().bytesWritten, 10);
  gate.resolve('file:///late.apk'); await pending; await flush();
  f.control.time = AUTO_CHECK_INTERVAL_MS + 1; await f.manager.check(false); await flush();
  assert.equal(f.count('download'), 1); assert.equal(f.count('install'), 0); assert.equal(f.manager.getSnapshot().status, 'cancelled');
});

test('后台不启动自动检查，下载后台完成仅回到前台安装一次', async () => {
  const f = fixture(); await f.manager.start(false); assert.equal(f.count('check'), 0);
  f.manager.setForeground(true); const gate = deferred(); f.control.download = () => gate.promise; await flush();
  f.manager.setForeground(false); gate.resolve('file:///ready.apk'); await flush();
  assert.equal(f.manager.getSnapshot().status, 'ready'); assert.equal(f.count('install'), 0);
  f.manager.setForeground(true); await flush(); assert.equal(f.count('install'), 1);
  f.manager.setForeground(false); f.manager.setForeground(true); await flush(); assert.equal(f.count('install'), 1);
});

test('自动前台检查有节流，手动检查不受间隔限制', async () => {
  const f = fixture(); f.control.latest = { ...release, version: '1.0.8' }; await f.manager.start();
  f.manager.setForeground(true); await f.manager.check(false); assert.equal(f.count('check'), 1);
  f.control.time = AUTO_CHECK_INTERVAL_MS; await f.manager.check(false); assert.equal(f.count('check'), 2);
  await f.manager.check(); assert.equal(f.count('check'), 3);
});

test('取消安装保留已完成文件，回到前台和定时检查都不反复弹窗', async () => {
  const f = fixture(); await f.manager.start(); await flush();
  f.control.time = AUTO_CHECK_INTERVAL_MS + 1; await f.manager.check(false); await flush();
  assert.equal(f.count('install'), 1); assert.equal(f.count('download'), 1);
  await f.manager.install(); await flush(); assert.equal(f.count('install'), 2); assert.equal(f.count('download'), 1);
});

test('安装器失败保留文件并可授权，设置返回后只重试安装一次', async () => {
  const f = fixture(); f.control.install = async () => { throw Error('permission denied'); };
  await f.manager.start(); await flush(); assert.equal(f.manager.getSnapshot().errorStage, 'install');
  f.control.install = undefined; await f.manager.openInstallSettings(); await flush();
  assert.equal(f.count('settings'), 1); assert.equal(f.count('install'), 2); assert.equal(f.count('download'), 1);
  assert.equal(f.manager.getSnapshot().status, 'ready');
});

test('安装包被系统清理后要求重新下载，不继续无效安装', async () => {
  const f = fixture(); await f.manager.start(); await flush(); f.control.exists = false;
  await f.manager.install(); assert.equal(f.manager.getSnapshot().errorStage, 'download');
  assert.match(f.manager.getSnapshot().error, /清理/); assert.equal(f.count('install'), 1);
  f.control.exists = true; await f.manager.retryDownload(); await flush(); assert.equal(f.count('download'), 2); assert.equal(f.count('install'), 2);
});

test('安装与授权进行中不会重复打开系统界面', async () => {
  const f = fixture(); const gate = deferred(); f.control.install = () => gate.promise;
  await f.manager.start(); await flush(); assert.equal(f.manager.getSnapshot().status, 'installing');
  void f.manager.install(); void f.manager.openInstallSettings(); void f.manager.check(); await flush();
  assert.equal(f.count('install'), 1); assert.equal(f.count('settings'), 0); gate.resolve(); await flush();
});

test('销毁后旧下载不能打开安装器或通知界面', async () => {
  const f = fixture(); const gate = deferred(); f.control.download = () => gate.promise; let notifications = 0;
  f.manager.subscribe(() => notifications++); const pending = f.manager.start(); await flush(); f.manager.dispose(); const before = notifications;
  gate.resolve('file:///late.apk'); await pending; await flush(); assert.equal(f.count('install'), 0); assert.equal(notifications, before);
});

test('已下载后重新检查遇到网络失败仍可使用缓存继续安装', async () => {
  const f = fixture(); await f.manager.start(); await flush();
  f.control.check = async () => { throw Error('GitHub offline'); };
  await f.manager.check();
  assert.equal(f.manager.getSnapshot().status, 'ready');
  assert.equal(f.manager.getSnapshot().errorStage, 'check');
  await f.manager.install(); await flush();
  assert.equal(f.count('install'), 2); assert.equal(f.count('download'), 1);
});

test('React重复挂载可在取消中的检查完成后恢复，不遗留永久busy', async () => {
  const f = fixture(); f.control.latest = { ...release, version: '1.0.8' };
  const old = f.manager.start(); f.manager.dispose(); const next = f.manager.start(); await old; await next; await flush();
  assert.equal(f.manager.getSnapshot().status, 'current'); assert.equal(f.manager.getSnapshot().busy, false);
  assert.equal(f.count('check'), 1);
});
