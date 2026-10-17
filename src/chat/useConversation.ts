import { useEffect, useRef, useState } from 'react';
import { useApi } from '../api/ApiProvider';
import { isRequestCancelled } from '../api/errors';
import { useServiceConnection } from '../connection/ConnectionProvider';
import { StreamAggregator, projectHistory, type MessageView } from './chat-state';

/** 单次挂载仅服务一个 thread；父级以 threadId 为 key 隔离旧流与历史。 */
export function useConversation(threadId: string) {
  const api = useApi();
  const connection = useServiceConnection();
  const enabled = connection?.enabled ?? true;
  const refreshVersion = connection?.snapshot.refreshVersion ?? 0;
  const enabledRef = useRef(enabled);
  const [views, setViews] = useState<MessageView[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const revisionRef = useRef<string | null>(null);
  const aliveRef = useRef(false);

  // 父级以 threadId 为 key：卸载时取消旧流，且所有异步回写都检查生命周期。
  // 不保挂载多个会话，也不让旧请求污染新会话或已退出登录的界面。
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        if (runIdRef.current) void api.stopRun(threadId, runIdRef.current).catch(() => {});
      }
    };
  }, [api, threadId]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) abortRef.current?.abort();
  }, [enabled]);

  // 历史与版本未成功加载前禁止发送，避免以旧版本覆盖其他设备的新消息。
  useEffect(() => {
    if (!enabled || abortRef.current) return;
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      setLoading(true);
      try {
        const history = await api.getConversation(threadId, controller.signal);
        if (alive) {
          revisionRef.current = history.revision;
          setViews(projectHistory(history.messages));
          setHistoryFailed(false);
          setError(undefined);
        }
      } catch (e) {
        if (alive && !isRequestCancelled(e)) {
          setHistoryFailed(true);
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; controller.abort(); };
  }, [api, threadId, historyVersion, enabled, refreshVersion]);

  const send = async (raw: string, onAccepted: () => void, onFailure: (text: string) => void) => {
    const text = raw.trim();
    if (!enabled || !text || loading || historyFailed || abortRef.current || !revisionRef.current) return;
    onAccepted();
    setError(undefined);
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = `run-${Date.now()}`;
    runIdRef.current = runId;

    // 历史是服务端事实；客户端只发送新消息和读取历史时的版本，不再复制用户序列。
    const expectedRevision = revisionRef.current;
    const userView: MessageView = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      toolCalls: [],
    };
    const aggregator = new StreamAggregator([...views, userView]);
    setViews([...aggregator.messages]);
    setRunning(true);
    try {
      await api.runAgent(
        {
          threadId,
          runId,
          expectedRevision,
          message: { id: userView.id, content: text },
        },
        (event) => {
          if (!aliveRef.current || controller.signal.aborted) return;
          aggregator.push(event);
          if (event.type === 'RUN_ERROR') setError(event.message ?? '助手运行失败，请重试');
          setViews([...aggregator.messages]);
        },
        controller.signal,
      );
      try {
        if (!enabledRef.current) {
          aggregator.settle();
          if (aliveRef.current) { setViews([...aggregator.messages]); setHistoryFailed(true); }
          return;
        }
        const history = await api.getConversation(threadId);
        if (aliveRef.current) {
          revisionRef.current = history.revision;
          setViews(projectHistory(history.messages));
        }
      } catch (syncError) {
        // 权威历史拉取失败：保留聚合视图（已验证的降级路径）
        aggregator.settle();
        if (aliveRef.current) {
          setViews([...aggregator.messages]);
          // 内容可以保留展示，但没有新版本不能安全发送下一轮。
          setHistoryFailed(true);
          if (!isRequestCancelled(syncError)) setError('回复已结束，但会话同步失败，请重新加载后继续');
        }
      }
    } catch (e) {
      aggregator.settle();
      if (aliveRef.current) setViews([...aggregator.messages]);
      if (aliveRef.current && (controller.signal.aborted || isRequestCancelled(e))) {
        if (!enabledRef.current) { setHistoryFailed(true); return; }
        // 停止也可能已落盘部分回复；恢复服务端历史与版本后才允许发送下一轮。
        try {
          const history = await api.getConversation(threadId);
          if (aliveRef.current) {
            revisionRef.current = history.revision;
            setViews(projectHistory(history.messages));
          }
        } catch (syncError) {
          if (aliveRef.current) {
            setHistoryFailed(true);
            if (!isRequestCancelled(syncError)) setError('停止后无法同步会话，请重新加载');
          }
        }
      } else if (aliveRef.current) {
        setError(e instanceof Error ? e.message : String(e));
        // 失败后保留待发送文本，但不覆盖用户在流式期间另写的新草稿。
        onFailure(text);
        // 请求可能已落盘，也可能因版本冲突被拒绝；先恢复权威历史再允许发送。
        setHistoryFailed(true);
      }
    } finally {
      if (aliveRef.current) setRunning(false);
      abortRef.current = null;
      runIdRef.current = null;
    }
  };

  const stop = async () => {
    const controller = abortRef.current;
    const runId = runIdRef.current;
    if (!controller || !runId) return;
    try {
      // 捕获本轮 controller：迟到的停止响应不能中断下一轮；false 也不能伪装停止成功。
      const stopped = await api.stopRun(threadId, runId);
      if (stopped && abortRef.current === controller) controller.abort();
    } catch (e) {
      if (aliveRef.current && abortRef.current === controller) {
        setError(`停止失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  const reload = () => {
    setLoading(true);
    setHistoryVersion((value) => value + 1);
  };
  return { views, running, error, loading: loading || !enabled, historyFailed, send, stop, reload };
}
