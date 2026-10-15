/**
 * 应用入口：ApiProvider 注入真实 HTTP 客户端 + 登录门 ⇄ 主界面切换。
 *
 * token 生命周期：登录（POST /api/session）→ expo-secure-store 持久化
 * （Web 调试用 localStorage）→ 启动时恢复 → 任何请求 401 时清除并回登录门。
 *
 * API 基址：Web 调试走本地代理（服务端暂未回 CORS 头，见 docs/notes.md
 * 与 tools/dev-proxy.mjs）；原生默认连接隔离 mock 服务 8788，Android
 * 模拟器用 10.0.2.2 访问宿主机。真机/真实服务通过公开环境变量显式指定。
 */
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from './src/lib/api-context';
import { HttpApiClient } from './src/lib/http-api';
import { clearToken, loadToken, saveToken } from './src/lib/token-store';
import { useSnapshotPolling } from './src/lib/use-snapshot';
import { AppShell, LoginGate, type ThreadInfo } from './src/shell';
import { ToastProvider } from './src/ui/toast';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? Platform.select({
  web: 'http://localhost:8791',
  android: 'http://10.0.2.2:8788',
  default: 'http://127.0.0.1:8788',
});

/** 生成符合服务端 threadId 约束的会话 id（字母开头，可含 _ -，≤64）。 */
function newThreadId() {
  return `side-${Math.random().toString(36).slice(2, 10)}`;
}

export default function App() {
  const tokenRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string>();
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [currentThread, setCurrentThread] = useState('local-main');

  const client = useMemo(
    () =>
      new HttpApiClient(
        API_BASE,
        () => tokenRef.current ?? undefined,
        () => {
          // 401：token 过期或失效，清空回登录门
          void clearToken().catch(() => setLoginError('无法清理已失效凭证，请检查设备存储权限'));
          tokenRef.current = null;
          setToken(null);
          setThreads([]);
          setCurrentThread('local-main');
        },
      ),
    [],
  );

  // 启动：恢复已保存的 token（24h 有效期内免登录）
  useEffect(() => {
    void (async () => {
      try {
        const saved = await loadToken();
        if (saved) {
          tokenRef.current = saved;
          setToken(saved);
        }
      } catch {
        // 存储不可用时仍显示登录门，不能让启动永远卡在空白屏。
        setLoginError('无法读取登录凭证，请重新登录并检查设备存储权限');
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  // 登录后拉会话列表（失败不阻塞进入，列表为空可新建）
  useEffect(() => {
    if (!token) return;
    let alive = true;
    client
      .listThreads()
      .then((items) => { if (alive) setThreads(items); })
      .catch(() => { if (alive) setThreads([{ id: 'local-main', updatedAt: new Date().toISOString() }]); });
    return () => { alive = false; };
  }, [token, client]);

  // 登录后启动快照轮询（顶栏/审批/工作台三页共用）
  const { snapshot, error: snapshotError, refresh } = useSnapshotPolling(client, token !== null);

  const login = async (accessKey?: string) => {
    setLoginBusy(true);
    setLoginError(undefined);
    try {
      const session = await client.createSession(accessKey);
      // 凭证落盘成功后再进入工作台，避免登录失败却已经展示受保护页面。
      await saveToken(session.token);
      tokenRef.current = session.token;
      setToken(session.token);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoginBusy(false);
    }
  };

  if (!booted) {
    // token 恢复期间的白屏（避免登录门闪现）
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ApiProvider client={client}>
        <ToastProvider>
          {token ? (
            <AppShell
              snapshot={snapshot}
              snapshotError={snapshotError}
              refresh={() => void refresh()}
              threads={threads.length ? threads : [{ id: 'local-main', updatedAt: new Date().toISOString() }]}
              currentThread={currentThread}
              onSelectThread={setCurrentThread}
              onCreateThread={() => {
                const id = newThreadId();
                setThreads((prev) => [{ id, updatedAt: new Date().toISOString() }, ...prev]);
                setCurrentThread(id);
              }}
            />
          ) : (
            <LoginGate onLogin={(key) => void login(key)} busy={loginBusy} error={loginError} />
          )}
        </ToastProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
}
