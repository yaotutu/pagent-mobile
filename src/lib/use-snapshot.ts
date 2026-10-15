/**
 * 登录后的工作区快照轮询：共享请求避免慢网叠加，旧登录周期的结果不能回写。
 * 手动刷新与定时刷新复用同一在途请求；请求完成后再计时，不引入状态库。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from './api';
import type { WorkspaceSnapshot } from './types';

export function useSnapshotPolling(api: ApiClient, enabled: boolean, intervalMs = 5000) {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const pending = useRef<{ generation: number; promise: Promise<void> } | undefined>(undefined);

  const refresh = useCallback((): Promise<void> => {
    if (!enabled) return Promise.resolve();
    const current = generation.current;
    if (pending.current?.generation === current) return pending.current.promise;
    const promise = (async () => {
      try {
        const next = await api.getSnapshot();
        if (generation.current !== current) return;
        setSnapshot(next);
        setError(undefined);
      } catch (e) {
        if (generation.current === current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (pending.current?.generation === current) pending.current = undefined;
      }
    })();
    pending.current = { generation: current, promise };
    return promise;
  }, [api, enabled]);

  useEffect(() => {
    const current = ++generation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      // 异步进入新周期，先清掉上一登录会话的数据；清理后的旧请求由代际检查丢弃。
      await Promise.resolve();
      if (generation.current !== current) return;
      setSnapshot(undefined);
      setError(undefined);
      const tick = async () => {
        await refresh();
        if (generation.current === current) timer = setTimeout(() => void tick(), intervalMs);
      };
      if (enabled) await tick();
    };
    void poll();
    return () => {
      generation.current = current + 1;
      clearTimeout(timer);
    };
  }, [enabled, refresh, intervalMs]);

  return { snapshot: enabled ? snapshot : undefined, error: enabled ? error : undefined, refresh };
}
