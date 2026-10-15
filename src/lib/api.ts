/**
 * API 客户端契约层：定义客户端与服务端交互的统一接口 + SSE 分帧解析。
 *
 * 职责边界（按"先 UI → mock → 接口"的开发流程）：
 * - 本文件只定形状与纯函数，不含任何网络实现；
 * - mock 阶段由 mock-api.ts 实现本接口（内存数据 + 假事件流）；
 * - 接口阶段由 http-api.ts 实现并替换（expo/fetch + Bearer token）。
 */

import type {
  AgentTask,
  AgUiEvent,
  ApprovalNotification,
  ConversationSnapshot,
  Goal,
  GoalStatus,
  Identity,
  MemoryItem,
  Monitor,
  TaskEvent,
  ThreadInfo,
  WorkspaceSnapshot,
} from './types';

/** 统一错误：status 为 HTTP 状态码（401 时上层清 token 回登录门）。 */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/** 增量聊天只提交一条新用户消息；历史与工具消息始终由服务端持有。 */
export type RunInput = {
  threadId: string;
  /** 本轮唯一 ID；成功请求可幂等重放。 */
  runId: string;
  /** 来自 GET /api/conversation；空会话也是明确的 empty 版本。 */
  expectedRevision: string;
  message: { id: string; content: string };
};

/**
 * 客户端接口：页面只依赖此抽象，不感知 mock/HTTP 差异。
 * 工作台操作（任务控制/目标/记忆/审批）在第 4 步页面落地时按需补充方法。
 */
export interface ApiClient {
  /** POST /api/session → {token, mode}；token 24h 有效 */
  createSession(accessKey?: string): Promise<{ token: string; mode: string }>;
  /** GET /api/threads（按活跃倒序） */
  listThreads(): Promise<ThreadInfo[]>;
  /** GET /api/conversation?threadId= 权威历史（只读，不回写） */
  getConversation(threadId: string): Promise<ConversationSnapshot>;
  /** 发起一轮对话：SSE 流式回调 AG-UI 事件；signal 中断即停止消费 */
  runAgent(
    input: RunInput,
    onEvent: (event: AgUiEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 只停止指定运行；迟到停止返回 false，不影响下一轮。 */
  stopRun(threadId: string, runId: string): Promise<boolean>;
  /** GET /api/agent 全量快照（顶栏状态/审批/工作台页共用） */
  getSnapshot(): Promise<WorkspaceSnapshot>;

  // --- 任务（POST /api/agent/tasks 系列） ---

  /** 创建后台任务（立即排队执行） */
  createTask(prompt: string, title?: string): Promise<AgentTask>;
  /** 任务详情（含时间线 events） */
  getTask(id: string): Promise<{ task: AgentTask; events: TaskEvent[] }>;
  /**
   * 控制任务：target=job（定时）或 task（后台），必须显式传入。
   * 以快照 task.kind 为准，禁止依赖服务端默认分发。
   */
  controlTask(
    id: string,
    action: TaskAction,
    target: TaskControlTarget,
  ): Promise<AgentTask>;

  // --- 监控（创建走聊天 monitor 工具，页面只做控制） ---

  controlMonitor(id: string, action: MonitorAction): Promise<Monitor>;

  // --- 审批 ---

  /** 决定挂起中的写操作；仅 pending 可决定（重复决定服务端 409） */
  decideAction(id: string, decision: ApprovalDecision): Promise<ApprovalNotification>;

  // --- 目标 ---

  createGoal(input: GoalInput): Promise<Goal>;
  /** 编辑不含里程碑（服务端编辑端点不接受 milestones） */
  updateGoal(id: string, input: Partial<Omit<GoalInput, 'milestones'>>): Promise<Goal>;
  /** completed 自动勾掉全部里程碑；重新激活不回退勾选 */
  setGoalStatus(id: string, status: GoalStatus): Promise<Goal>;
  toggleMilestone(goalId: string, milestoneId: string): Promise<Goal>;
  removeGoal(id: string): Promise<void>;

  // --- 身份 / 记忆 / 人设 ---

  saveIdentity(input: IdentityInput): Promise<Identity>;
  addMemory(text: string, source?: string): Promise<MemoryItem>;
  editMemory(id: string, text: string): Promise<MemoryItem>;
  forgetMemory(id: string): Promise<void>;
  /** SOUL/USER 人设文本（空串=未设置） */
  getProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<Profile>;
}

export type TaskAction = 'pause' | 'resume' | 'cancel' | 'retry';
export type TaskControlTarget = 'job' | 'task';
export type MonitorAction = 'pause' | 'resume' | 'stop';
export type ApprovalDecision = 'approve' | 'deny';
export type GoalInput = {
  title: string;
  description?: string;
  category?: string;
  /** 里程碑标题列表（仅创建时） */
  milestones?: string[];
};
export type IdentityInput = {
  name: string;
  tone: string;
  avatar?: string;
  showChatUpdates?: boolean;
};
export type Profile = { soul: string; user: string };

/**
 * SSE 分帧解析（纯函数）：吃进增量缓冲，吐出完整帧内解析出的 JSON 事件
 * 与剩余未闭合缓冲。翻译自 personal-bot web/src/lib/api.ts：
 * 事件流以空行（LF 或 CRLF）分帧，帧内逐行取 "data: " 前缀的 JSON 载荷；
 * 非 JSON 帧忽略（协议错误由 RUN_ERROR 事件表达，不在此抛错）。
 * 接口阶段的 http-api.ts 把 expo/fetch 的 ReadableStream 增量喂给它。
 */
export function parseSseFrames(buffer: string): { events: AgUiEvent[]; rest: string } {
  const events: AgUiEvent[] = [];
  let rest = buffer;
  for (;;) {
    // 只消费完整空行，不预先替换换行符：CRLF 的 \r 与 \n 可能分属两次读取，
    // 必须将未闭合尾部原样交还调用方，待下个 chunk 拼接后再判断边界。
    const boundary = /\r?\n\r?\n/.exec(rest);
    if (!boundary) break;
    const frame = rest.slice(0, boundary.index);
    rest = rest.slice(boundary.index + boundary[0].length);
    for (const line of frame.split(/\r?\n/)) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        events.push(JSON.parse(payload) as AgUiEvent);
      } catch {
        // 非 JSON 帧忽略
      }
    }
  }
  return { events, rest };
}
