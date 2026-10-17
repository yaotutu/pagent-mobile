import { isNewerVersion } from './releases';
import type { AppRelease, UpdateSnapshot } from './types';

export const AUTO_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type UpdateDependencies = {
  currentVersion: string | null;
  supported: boolean;
  unsupportedReason?: string;
  getLatestRelease: (signal: AbortSignal) => Promise<AppRelease>;
  download: (release: AppRelease, signal: AbortSignal, onProgress: (written: number, total?: number) => void, force: boolean) => Promise<string>;
  fileExists: (uri: string) => boolean;
  install: (uri: string) => Promise<void>;
  openInstallSettings: () => Promise<void>;
  now?: () => number;
};

export class UpdateManager {
  private snapshot: UpdateSnapshot;
  private listeners = new Set<() => void>();
  private job?: Promise<void>;
  private controller?: AbortController;
  private generation = 0;
  private disposed = false;
  private foreground = true;
  private lastCheck?: number;
  private fileUri?: string;
  private autoInstallPending = false;
  private blockedAsset?: number;

  constructor(private readonly dependencies: UpdateDependencies) {
    this.snapshot = {
      status: dependencies.supported && dependencies.currentVersion ? 'idle' : 'unsupported',
      currentVersion: dependencies.currentVersion,
      unsupportedReason: dependencies.unsupportedReason,
      bytesWritten: 0,
      busy: false,
      installAttempted: false,
      noticeVersion: 0,
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Partial<UpdateSnapshot>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }
  private current(id: number) { return !this.disposed && this.generation === id; }

  start = (foreground = true) => {
    this.disposed = false;
    this.foreground = foreground;
    if (!foreground) return Promise.resolve();
    if (this.job) return this.job.then(() => { if (!this.disposed && this.foreground) return this.check(false); });
    return this.check(false);
  };

  setForeground = (foreground: boolean) => {
    this.foreground = foreground;
    if (foreground && !this.disposed) {
      this.maybeInstall();
      void this.check(false);
    }
  };

  private run(action: (id: number, signal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.job) return this.job;
    const controller = new AbortController();
    this.controller = controller;
    const id = ++this.generation;
    this.publish({ busy: true });
    const job = Promise.resolve().then(async () => {
      if (this.current(id)) await action(id, controller.signal);
    }).catch((error: unknown) => {
      if (!this.current(id)) return;
      const errorStage = this.snapshot.status === 'checking' ? 'check' : this.snapshot.status === 'downloading' ? 'download' : 'install';
      const cached = errorStage === 'check' && !!this.fileUri && this.dependencies.fileExists(this.fileUri);
      this.publish({ status: cached ? 'ready' : 'error', errorStage, error: error instanceof Error ? error.message : '更新失败，请稍后重试' });
    }).finally(() => {
      if (this.job !== job) return;
      this.job = undefined;
      this.controller = undefined;
      if (!this.disposed) {
        this.publish({ busy: false });
        this.maybeInstall();
      }
    });
    this.job = job;
    return job;
  }

  check = (manual = true): Promise<void> => {
    if (this.disposed || this.snapshot.status === 'unsupported') return Promise.resolve();
    if (this.job) return this.job;
    const now = (this.dependencies.now ?? Date.now)();
    if (!manual && (!this.foreground || (this.lastCheck !== undefined && now - this.lastCheck < AUTO_CHECK_INTERVAL_MS))) return Promise.resolve();
    this.lastCheck = now;
    this.publish({ status: 'checking', error: undefined, errorStage: undefined, message: undefined });
    return this.run(async (id, signal) => {
      const release = await this.dependencies.getLatestRelease(signal);
      if (!this.current(id)) return;
      if (!isNewerVersion(release.version, this.snapshot.currentVersion!)) {
        this.autoInstallPending = false;
        this.publish({ status: 'current', release: undefined, bytesWritten: 0, totalBytes: undefined, installAttempted: false });
        return;
      }
      if (!manual && release.assetId === this.blockedAsset) {
        this.publish({ status: this.fileUri ? 'ready' : 'cancelled', release });
        return;
      }
      await this.downloadRelease(id, signal, release, false);
    });
  };

  private async downloadRelease(id: number, signal: AbortSignal, release: AppRelease, force: boolean) {
    this.autoInstallPending = false;
    this.fileUri = undefined;
    this.publish({
      status: 'downloading', release, bytesWritten: 0, totalBytes: release.size,
      installAttempted: false, error: undefined, errorStage: undefined, message: undefined,
      noticeVersion: this.snapshot.noticeVersion + 1,
    });
    const uri = await this.dependencies.download(release, signal, (written, total) => {
      if (this.current(id)) this.publish({ bytesWritten: written, totalBytes: total && total > 0 ? total : undefined });
    }, force);
    if (!this.current(id)) return;
    this.fileUri = uri;
    this.autoInstallPending = true;
    this.publish({ status: 'ready', message: this.foreground ? '安装包已下载，正在打开系统安装界面' : '安装包已下载，返回应用后打开系统安装界面' });
  }

  retryDownload = (): Promise<void> => {
    const release = this.snapshot.release;
    if (this.disposed || !release || this.job || this.snapshot.status === 'unsupported') return Promise.resolve();
    this.blockedAsset = undefined;
    return this.run((id, signal) => this.downloadRelease(id, signal, release, true));
  };

  cancel = () => {
    if (!['checking', 'downloading'].includes(this.snapshot.status)) return;
    this.blockedAsset = this.snapshot.release?.assetId;
    this.autoInstallPending = false;
    this.generation++;
    this.controller?.abort();
    this.publish({ status: 'cancelled', error: undefined, errorStage: undefined, message: '已取消，可手动重试' });
  };

  private maybeInstall() {
    if (this.autoInstallPending && this.foreground && !this.job && !this.disposed) void this.install();
  }

  install = (): Promise<void> => {
    if (this.disposed || this.job || !this.foreground || !this.fileUri) return Promise.resolve();
    this.autoInstallPending = false;
    this.blockedAsset = this.snapshot.release?.assetId;
    const uri = this.fileUri;
    if (!this.dependencies.fileExists(uri)) {
      this.fileUri = undefined;
      this.publish({ status: 'error', errorStage: 'download', error: '安装包已被系统清理，请重新下载', message: undefined });
      return Promise.resolve();
    }
    this.publish({ status: 'installing', installAttempted: true, error: undefined, errorStage: undefined, message: '请在系统界面确认安装，首次可能需要允许安装未知应用' });
    return this.run(async (id) => {
      await this.dependencies.install(uri);
      // 启动安装器不代表升级完成；用户取消后保留安装包，不循环弹窗。
      if (this.current(id)) this.publish({ status: 'ready', message: '已返回应用。如尚未完成安装，可继续安装或检查系统授权' });
    });
  };

  openInstallSettings = (): Promise<void> => {
    if (this.disposed || this.job || !this.fileUri || !this.foreground) return Promise.resolve();
    this.publish({ status: 'installing', error: undefined, errorStage: undefined, message: '请在系统设置中允许 Pagent 安装应用，返回后继续安装' });
    return this.run(async (id) => {
      await this.dependencies.openInstallSettings();
      if (this.current(id)) {
        this.autoInstallPending = true;
        this.publish({ status: 'ready' });
      }
    });
  };

  dispose = () => {
    if (this.snapshot.status === 'checking') this.lastCheck = undefined;
    this.disposed = true;
    this.generation++;
    this.autoInstallPending = false;
    this.controller?.abort();
    this.listeners.clear();
  };
}
