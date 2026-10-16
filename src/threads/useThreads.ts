import { useEffect, useState } from 'react';
import { useApi } from '../api/ApiProvider';
import type { ThreadInfo } from '../api/types';
import { useDemo } from '../demo/DemoProvider';
import { MAIN_THREAD, mainThread, newThread } from './thread-state';

export function useThreads() {
  const api = useApi();
  const demo = useDemo();
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [localThreads, setLocalThreads] = useState<ThreadInfo[]>([]);
  const [currentThread, selectThread] = useState(MAIN_THREAD);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    api.listThreads()
      .then((items) => { if (alive) { setThreads(items); setError(undefined); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, [api, attempt]);

  const createThread = () => {
    const thread = newThread();
    demo?.client.renameThread(thread.id, '新的会话');
    setLocalThreads((previous) => [thread, ...previous]);
    selectThread(thread.id);
  };
  // 首次列表响应不能覆盖用户在请求期间新建的旁支。
  const merged = [...localThreads, ...threads.filter((thread) => !localThreads.some((item) => item.id === thread.id))];
  return { threads: merged.length ? merged : [mainThread()], currentThread, selectThread, createThread, error, reload: () => setAttempt((value) => value + 1) };
}
