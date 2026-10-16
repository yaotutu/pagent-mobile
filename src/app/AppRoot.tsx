import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider, useApi } from '../api/ApiProvider';
import { LoginScreen } from '../auth/LoginScreen';
import { useSession } from '../auth/useSession';
import { DemoApiClient } from '../demo/DemoApiClient';
import { DemoProvider } from '../demo/DemoProvider';
import { useThreads } from '../threads/useThreads';
import { ToastProvider } from '../ui/toast';
import { useWorkspaceSnapshot } from '../workspace/useWorkspaceSnapshot';
import { AppShell } from './AppShell';
import { API_BASE } from './config';

function Workspace({ onDemo }: { onDemo: () => void }) {
  const api = useApi();
  const { snapshot, error, refresh } = useWorkspaceSnapshot(api, true);
  const { threads, currentThread, selectThread, createThread, error: threadsError, reload } = useThreads();
  return (
    <AppShell snapshot={snapshot} snapshotError={error} refresh={() => void refresh()}
      threads={threads} currentThread={currentThread} threadsError={threadsError} reloadThreads={reload}
      onSelectThread={selectThread} onCreateThread={createThread} onDemo={onDemo} />
  );
}

// 服务鉴权仅在真实分支挂载；演示分支不加载或保存任何服务凭证。
function ServiceRoot({ onDemo }: { onDemo: () => void }) {
  const { client, token, booted, busy, error, login } = useSession(API_BASE);
  if (!booted) return null;
  return (
    <ApiProvider client={client}>
      {token ? <Workspace onDemo={onDemo} /> : <LoginScreen onLogin={(key) => void login(key)} busy={busy} error={error} onDemo={onDemo} />}
    </ApiProvider>
  );
}

function DemoRoot({ client, reset, exit }: { client: DemoApiClient; reset: (empty?: boolean) => void; exit: () => void }) {
  useEffect(() => () => client.dispose(), [client]);
  return (
    <DemoProvider value={{ client, reset, exit }}>
      <ApiProvider client={client}><Workspace onDemo={() => reset()} /></ApiProvider>
    </DemoProvider>
  );
}

export default function AppRoot() {
  const [demo, setDemo] = useState<{ client: DemoApiClient; generation: number }>();
  const enterDemo = (empty = false) => setDemo((previous) => ({ client: new DemoApiClient(empty), generation: (previous?.generation ?? 0) + 1 }));
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ToastProvider>
        {demo
          ? <DemoRoot key={demo.generation} client={demo.client} reset={enterDemo} exit={() => setDemo(undefined)} />
          : <ServiceRoot onDemo={() => enterDemo()} />}
      </ToastProvider>
    </SafeAreaProvider>
  );
}
