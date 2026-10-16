/**
 * 真实 HTTP 客户端：expo/fetch（原生流式支持）+ Bearer token + SSE 分帧消费。
 *
 * 协议要点（对齐 openapi 与已验证的 web 端实现）：
 * - 统一错误形状 {error}；401 由构造方注入的 onUnauthorized 处理
 *   （清 token 回登录门）；
 * - run 只发送新用户消息与历史版本，服务端负责历史一致性及冲突检测；
 * - SSE 用 parseSseFrames 按 \n\n 分帧（翻译自 personal-bot web/src/lib/api.ts），
 *   非 JSON 帧忽略，协议错误由 RUN_ERROR 事件表达。
 */

import { fetch as expoFetch } from 'expo/fetch';
import type {
  AgentTask,
  ApprovalNotification,
  ConversationSnapshot,
  Goal,
  GoalStatus,
  Identity,
  MemoryItem,
  Monitor,
  TaskDetails,
  ThreadInfo,
  WorkspaceSnapshot,
  WorkspaceData,
} from './types';
import {
  type ApiClient,
  type ApprovalDecision,
  type GoalInput,
  type IdentityInput,
  type MonitorAction,
  type Profile,
  type RunInput,
  type TaskAction,
  type TaskControlTarget,
} from './contracts';
import { ApiError } from './errors';
import { parseSseFrames } from './sse';

export class HttpApiClient implements ApiClient {
  constructor(
    private readonly baseUrl: string,
    /** 取当前 token（登录前为 undefined，请求不带 Authorization 头） */
    private readonly getToken: () => string | undefined,
    /** 401 回调：上层清 token 回登录门 */
    private readonly onUnauthorized: () => void,
  ) {}

  private async request<T>(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<T> {
    const token = this.getToken();
    const response = await expoFetch(`${this.baseUrl}${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (response.status === 401) {
      this.onUnauthorized();
      throw new ApiError(401, '登录已过期，请重新登录');
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = `请求失败 (${response.status})`;
      try {
        const data = JSON.parse(text) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // 非 JSON 错误体，保留通用文案
      }
      throw new ApiError(response.status, message);
    }
    return (await response.json()) as T;
  }

  async createSession(accessKey?: string): Promise<{ token: string; mode: string }> {
    // 登录时无 token，请求不带 Authorization 头
    return this.request<{ token: string; mode: string }>('/api/session', {
      method: 'POST',
      body: accessKey ? { accessKey } : {},
    });
  }

  async listThreads(): Promise<ThreadInfo[]> {
    const data = await this.request<{ threads: ThreadInfo[] }>('/api/threads');
    return data.threads;
  }

  async getConversation(threadId: string): Promise<ConversationSnapshot> {
    return this.request<ConversationSnapshot>(`/api/conversation?threadId=${encodeURIComponent(threadId)}`);
  }

  async runAgent(
    input: RunInput,
    onEvent: (event: import('./types').AgUiEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const token = this.getToken();
    const response = await expoFetch(`${this.baseUrl}/api/conversation/run`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      // 当前 OpenAPI 只接受增量请求；不回写助手/工具历史，也不发送 SDK 透传字段。
      body: JSON.stringify(input),
      signal,
    });
    if (response.status === 401) {
      this.onUnauthorized();
      throw new ApiError(401, '登录已过期，请重新登录');
    }
    if (!response.ok) {
      // 冲突由历史版本或当前运行状态引起，提示用户同步后重试，不自动重放可能已执行的操作。
      if (response.status === 409) throw new ApiError(409, '会话状态已更新或仍在运行，请重新加载后重试');
      const data = await response.json().catch(() => undefined) as { error?: unknown } | undefined;
      throw new ApiError(response.status, typeof data?.error === 'string' ? data.error : `请求失败 (${response.status})`);
    }
    if (!response.body) throw new ApiError(response.status, '回复连接未返回数据流');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let terminal = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseFrames(buffer);
        buffer = rest;
        for (const event of events) {
          if (event.type === 'RUN_FINISHED' || event.type === 'RUN_ERROR') terminal = true;
          onEvent(event);
        }
      }
      // 正常结束必须有协议终止事件；断网 EOF 不能伪装成成功完成。
      if (!terminal && !signal?.aborted) throw new Error('回复连接意外中断，请重新加载会话后重试');
    } finally {
      // 回调异常或主动取消时也归还 reader，避免遗留原生流资源。
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  async stopRun(threadId: string, runId: string): Promise<boolean> {
    const data = await this.request<{ stopped: boolean }>(
      '/api/conversation/stop',
      { method: 'POST', body: { threadId, runId } },
    );
    return data.stopped;
  }

  async getSnapshot(): Promise<WorkspaceSnapshot> {
    // 工作区快照不包含审批正文；两端点属于同一轮刷新，任一失败都不提交半份新状态。
    const [workspace, pending] = await Promise.all([
      this.request<WorkspaceData>('/api/agent'),
      this.request<{ actions: ApprovalNotification[] }>('/api/actions/pending'),
    ]);
    return { ...workspace, notifications: pending.actions };
  }

  async createTask(prompt: string, title?: string): Promise<AgentTask> {
    return this.request<AgentTask>('/api/agent/tasks', {
      method: 'POST',
      body: title ? { prompt, title } : { prompt },
    });
  }

  async getTask(id: string): Promise<TaskDetails> {
    return this.request<TaskDetails>(`/api/agent/tasks/${encodeURIComponent(id)}`);
  }

  async controlTask(id: string, action: TaskAction, target: TaskControlTarget): Promise<AgentTask> {
    return this.request<AgentTask>(`/api/agent/tasks/${encodeURIComponent(id)}/control`, {
      method: 'POST',
      body: { action, target },
    });
  }

  async controlMonitor(id: string, action: MonitorAction): Promise<Monitor> {
    return this.request<Monitor>(`/api/agent/monitors/${encodeURIComponent(id)}/control`, {
      method: 'POST',
      body: { action },
    });
  }

  async decideAction(id: string, decision: ApprovalDecision): Promise<ApprovalNotification> {
    return this.request<ApprovalNotification>(`/api/actions/${encodeURIComponent(id)}/decide`, {
      method: 'POST',
      body: { decision },
    });
  }

  async createGoal(input: GoalInput): Promise<Goal> {
    return this.request<Goal>('/api/agent/goals', { method: 'POST', body: input });
  }

  async updateGoal(id: string, input: Partial<Omit<GoalInput, 'milestones'>>): Promise<Goal> {
    return this.request<Goal>(`/api/agent/goals/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: input,
    });
  }

  async setGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
    return this.request<Goal>(`/api/agent/goals/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: { status },
    });
  }

  async toggleMilestone(goalId: string, milestoneId: string): Promise<Goal> {
    return this.request<Goal>(
      `/api/agent/goals/${encodeURIComponent(goalId)}/milestones/${encodeURIComponent(milestoneId)}/toggle`,
      { method: 'POST', body: {} },
    );
  }

  async removeGoal(id: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/api/agent/goals/${encodeURIComponent(id)}/remove`, {
      method: 'POST',
      body: {},
    });
  }

  async saveIdentity(input: IdentityInput): Promise<Identity> {
    return this.request<Identity>('/api/agent/identity', { method: 'POST', body: input });
  }

  async addMemory(text: string, source?: string): Promise<MemoryItem> {
    return this.request<MemoryItem>('/api/agent/memories', {
      method: 'POST',
      body: source ? { text, source } : { text },
    });
  }

  async editMemory(id: string, text: string): Promise<MemoryItem> {
    return this.request<MemoryItem>(`/api/agent/memories/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: { text },
    });
  }

  async forgetMemory(id: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/api/agent/memories/${encodeURIComponent(id)}/forget`, {
      method: 'POST',
      body: {},
    });
  }

  async getProfile(): Promise<Profile> {
    return this.request<Profile>('/api/profile');
  }

  async saveProfile(profile: Profile): Promise<Profile> {
    return this.request<Profile>('/api/profile', { method: 'PUT', body: profile });
  }
}
