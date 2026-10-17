import { fetch } from 'expo/fetch';
import type { AppRelease } from './types';

export const RELEASE_REPOSITORY = 'yaotutu/pi-muse-mobile';
export const LATEST_RELEASE_URL = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
const APK_NAME = 'app-release.apk';
const CHECK_TIMEOUT_MS = 15_000;

function versionParts(version: string): number[] {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('版本号格式不受支持');
  const parts = version.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('版本号格式不受支持');
  return parts;
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  const next = versionParts(candidate);
  const current = versionParts(installed);
  for (let index = 0; index < next.length; index++) {
    if (next[index] !== current[index]) return next[index] > current[index];
  }
  return false;
}

export function parseRelease(value: unknown): AppRelease {
  if (!value || typeof value !== 'object') throw new Error('发布信息格式不正确');
  const release = value as Record<string, unknown>;
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string' || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) {
    throw new Error('当前发布不是受支持的正式版本');
  }
  const version = release.tag_name.slice(1);
  versionParts(version);
  if (!Number.isSafeInteger(release.id) || (release.id as number) <= 0 || !Array.isArray(release.assets)) throw new Error('发布信息缺少有效安装包');
  const assets = release.assets.filter((asset: unknown) => !!asset && typeof asset === 'object' && (asset as Record<string, unknown>).name === APK_NAME);
  if (assets.length !== 1) throw new Error('正式版本没有唯一的 Android 安装包');
  const asset = assets[0] as Record<string, unknown>;
  if (!Number.isSafeInteger(asset.id) || (asset.id as number) <= 0 || !Number.isSafeInteger(asset.size) || (asset.size as number) <= 0 || typeof asset.browser_download_url !== 'string') {
    throw new Error('安装包信息不完整');
  }
  const url = new URL(asset.browser_download_url);
  // 更新只来自官方仓库，业务服务器不能指定可执行安装包。
  if (url.protocol !== 'https:' || url.host !== 'github.com' || url.username || url.password || url.search || url.hash || url.pathname !== `/${RELEASE_REPOSITORY}/releases/download/${release.tag_name}/${APK_NAME}`) {
    throw new Error('安装包不属于官方发布地址');
  }
  return { id: release.id as number, assetId: asset.id as number, version, size: asset.size as number, url: url.href };
}

export async function getLatestRelease(signal: AbortSignal, timeoutMs = CHECK_TIMEOUT_MS): Promise<AppRelease> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    // 与业务客户端隔离：不附带用户服务器的 Token、Key 或 Cookie。
    const response = await fetch(LATEST_RELEASE_URL, {
      signal: controller.signal,
      credentials: 'omit',
      headers: { Accept: 'application/vnd.github+json' },
      redirect: 'error',
    });
    if (response.status === 404) throw new Error('暂时没有可用的正式版本');
    if (response.status === 403 || response.status === 429) throw new Error('GitHub 检查更新请求受限，请稍后重试');
    if (!response.ok) throw new Error(`检查更新失败（HTTP ${response.status}），请稍后重试`);
    const release = parseRelease(await response.json());
    if (controller.signal.aborted) throw new Error('检查更新已取消');
    return release;
  } catch (error) {
    if (timedOut) throw new Error('检查更新超时，请稍后重试');
    if (signal.aborted) { const cancelled = new Error('检查更新已取消'); cancelled.name = 'AbortError'; throw cancelled; }
    throw error instanceof Error ? error : new Error('无法连接 GitHub，请检查网络后重试');
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
