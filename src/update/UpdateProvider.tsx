import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createUpdateDependencies } from './native-updates';
import { UpdateSheet } from './UpdateSheet';
import type { UpdateSnapshot } from './types';
import { AUTO_CHECK_INTERVAL_MS, UpdateManager } from './update-manager';

type AppUpdate = { snapshot: UpdateSnapshot; open: () => void };
const AppUpdateContext = createContext<AppUpdate | null>(null);

export function UpdateProvider({ children, manager: suppliedManager }: { children: ReactNode; manager?: UpdateManager }) {
  const [manager] = useState(() => suppliedManager ?? new UpdateManager(createUpdateDependencies()));
  const [snapshot, setSnapshot] = useState(manager.getSnapshot);
  const [open, setOpen] = useState(() => snapshot.noticeVersion > 0);

  useEffect(() => {
    let notice = manager.getSnapshot().noticeVersion;
    const unsubscribe = manager.subscribe(() => {
      const next = manager.getSnapshot();
      setSnapshot(next);
      if (next.noticeVersion > notice) setOpen(true);
      notice = next.noticeVersion;
    });
    let timer: ReturnType<typeof setInterval> | undefined;
    const watchForeground = (active: boolean) => {
      clearInterval(timer);
      if (active) timer = setInterval(() => { void manager.check(false); }, AUTO_CHECK_INTERVAL_MS);
    };
    const active = AppState.currentState === 'active';
    void manager.start(active);
    watchForeground(active);
    const subscription = AppState.addEventListener('change', (state) => {
      manager.setForeground(state === 'active');
      watchForeground(state === 'active');
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
      unsubscribe();
      manager.dispose();
    };
  }, [manager]);

  return <AppUpdateContext.Provider value={{ snapshot, open: () => setOpen(true) }}>
    {children}
    {open && <UpdateSheet snapshot={snapshot} onClose={() => setOpen(false)}
      onCheck={() => { void manager.check(); }} onCancel={manager.cancel}
      onInstall={() => { void manager.install(); }} onRetryDownload={() => { void manager.retryDownload(); }}
      onOpenSettings={() => { void manager.openInstallSettings(); }} />}
  </AppUpdateContext.Provider>;
}

export function useAppUpdate() { return useContext(AppUpdateContext); }
