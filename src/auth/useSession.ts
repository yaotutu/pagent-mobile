import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpApiClient } from '../api/http-client';
import { clearToken, loadToken, saveToken } from './token-store';

/** 客户端身份在登录周期之间保持稳定，请求时再读取当前凭证。 */
export function useSession(baseUrl: string) {
  const tokenRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const getToken = useCallback(() => tokenRef.current ?? undefined, []);
  const invalidate = useCallback(() => {
    void clearToken().catch(() => setError('无法清理已失效凭证，请检查设备存储权限'));
    tokenRef.current = null;
    setToken(null);
  }, []);
  // 构造器只保存回调，不在渲染期调用；凭证仅在实际发请求时读取。
  // eslint-disable-next-line react-hooks/refs
  const client = useMemo(() => new HttpApiClient(baseUrl, getToken, invalidate), [baseUrl, getToken, invalidate]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const saved = await loadToken();
        if (alive && saved) {
          tokenRef.current = saved;
          setToken(saved);
        }
      } catch {
        if (alive) setError('无法读取登录凭证，请重新登录并检查设备存储权限');
      } finally {
        if (alive) setBooted(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const login = async (accessKey?: string) => {
    setBusy(true);
    setError(undefined);
    try {
      const session = await client.createSession(accessKey);
      // 持久化成功才进入受保护界面，避免存储失败却显示已登录。
      await saveToken(session.token);
      tokenRef.current = session.token;
      setToken(session.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return { client, token, booted, busy, error, login };
}
