/**
 * Mock 实现：内存数据 + 定时器驱动的假 AG-UI 事件流 + 工作台 mutations。
 *
 * 边界：仅供 UI 阶段驱动界面联调，行为对齐 ApiClient 契约
 * （延迟、流式分帧、abort、状态迁移语义都模拟真实服务端）。
 * 接口阶段整文件退场，由 http-api.ts 接替。
 */

import type {
  AgentTask,
  AgUiEvent,
  ApprovalNotification,
  ConversationMessage,
  Goal,
  GoalStatus,
  Identity,
  MemoryItem,
  Monitor,
  TaskEvent,
  TaskDetails,
  ThreadInfo,
  WorkspaceSnapshot,
} from './types';
import {
  ApiError,
  type ApiClient,
  type ApprovalDecision,
  type GoalInput,
  type IdentityInput,
  type MonitorAction,
  type Profile,
  type RunInput,
  type TaskAction,
  type TaskControlTarget,
} from './api';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// 假 SSE 编排
// ---------------------------------------------------------------------------

/** 用户消息文本 → mock 编排策略：按关键词决定是否插入工具调用 */
type Script = { tool?: { name: string; args: string; result: string }; reply: string };

function scriptFor(text: string): Script {
  if (/搜|查|search/i.test(text)) {
    return {
      tool: {
        name: 'search_web',
        args: JSON.stringify({ query: text }),
        result: JSON.stringify({
          results: [
            { title: 'Pagent · 个人助理', url: 'https://example.com/pagent', snippet: '一个可托付日常事务的助理。' },
            { title: 'AG-UI 协议说明', url: 'https://example.com/ag-ui', snippet: '事件驱动的 agent 交互协议。' },
            { title: 'Expo 文档', url: 'https://docs.expo.dev', snippet: '构建通用 React 应用。' },
          ],
        }),
      },
      reply: '帮你查了一圈，比较靠谱的入口有这几个：\n\n1. **Pagent 官方页** — 项目与功能总览\n2. **AG-UI 协议说明** — 事件流怎么工作\n3. **Expo 文档** — 客户端工程基础\n\n需要我盯着其中某个页面的更新吗？可以直接说"帮我监控 xxx"。',
    };
  }
  if (/记住|记一下|remember/i.test(text)) {
    return {
      tool: {
        name: 'memory',
        args: JSON.stringify({ action: 'save', text }),
        result: JSON.stringify({ saved: true }),
      },
      reply: '记下了 ✅ 这条已经进我的长期记忆，之后相关话题我会主动想起它。可以在「应用 → 记忆」里查看或修改。',
    };
  }
  if (/写入|写文件|保存到/i.test(text)) {
    return {
      tool: {
        name: 'write',
        args: JSON.stringify({ path: 'notes.md', content: '# 今日待办\n- 完成聊天主链路\n- 验证 mock 流式\n' }),
        result: JSON.stringify({ written: true, bytes: 64 }),
      },
      reply: '已把内容写入 `notes.md`。真实服务下这一步会先请求你的批准，批准后才落盘。',
    };
  }
  return {
    reply:
      '收到。我是 mock 模式的回复：主链路（流式文本、工具卡、停止）都能在这个模式里验证。\n\n试试对我说：\n- "搜一下 pagent"\n- "记住我喜欢早起"\n- "把待办写入 notes.md"',
  };
}

// ---------------------------------------------------------------------------
// Mock 客户端
// ---------------------------------------------------------------------------

export class MockApiClient implements ApiClient {
  private readonly threads: ThreadInfo[];
  private readonly conversations = new Map<string, ConversationMessage[]>();
  /** 每个会话只维护一个本地版本号；空会话对外固定使用服务端约定的 `empty`。 */
  private readonly conversationRevisions = new Map<string, number>();
  private readonly tasks: (AgentTask & { events?: TaskEvent[] })[];
  private goals: Goal[];
  private readonly monitors: Monitor[];
  private memories: MemoryItem[];
  private notifications: ApprovalNotification[];
  private identity: Identity;
  private profile: Profile;
  /** stopRun 只匹配当前同一会话的 runId，迟到请求不能影响后续一轮。 */
  private readonly activeRuns = new Map<string, string>();
  private readonly abortedRuns = new Set<string>();

  constructor() {
    const now = Date.now();
    this.threads = [
      { id: 'local-main', updatedAt: new Date(now).toISOString() },
      { id: 'side-shopping', updatedAt: new Date(now - 36e5).toISOString() },
    ];
    this.conversations.set('local-main', [
      { id: 'm1', role: 'user', content: '你好，介绍下你能做什么' },
      {
        id: 'm2',
        role: 'assistant',
        content: '你好！我是你的个人助理，可以：\n\n- **搜索**与资料整理\n- **记住**你的偏好\n- 安排**定时任务**与**网页监控**\n- 代替你跑**后台任务**',
      },
    ]);
    this.conversationRevisions.set('local-main', 1);

    const base = { error: null };
    this.tasks = [
      {
        ...base,
        id: 'task-email',
        title: '整理订阅邮件',
        prompt: '把过去一周的订阅邮件按主题归类，输出一份摘要。',
        kind: 'task',
        status: 'running',
        createdAt: iso(-25 * 60e3),
        updatedAt: iso(-5 * 60e3),
        result: undefined,
        events: [
          { id: 'e1', taskId: 'task-email', date: iso(-25 * 60e3), kind: 'plan', title: '任务已排队', detail: '等待 worker 空闲后执行。' },
          { id: 'e2', taskId: 'task-email', date: iso(-24 * 60e3), kind: 'status', title: '开始执行', detail: '进入独立会话运行。' },
          { id: 'e3', taskId: 'task-email', date: iso(-12 * 60e3), kind: 'step', title: '拉取最近 7 天邮件', detail: '共 46 封，其中订阅类 31 封。' },
          { id: 'e4', taskId: 'task-email', date: iso(-5 * 60e3), kind: 'observation', title: '正在按主题聚类', detail: '科技 / 财经 / 生活 三类。' },
        ],
      },
      {
        ...base,
        id: 'task-weekly',
        title: '每周复盘提醒',
        prompt: '每周日 20:00 提醒我写周报，并给出上周的关键事件清单。',
        kind: 'job',
        status: 'scheduled',
        createdAt: iso(-6 * 864e5),
        updatedAt: iso(-2 * 864e5),
        nextRunAt: iso(2 * 864e5),
        result: '已生成上周关键事件清单（12 条）。',
      },
      {
        ...base,
        id: 'task-price',
        title: '竞品价格梳理',
        prompt: '抓取三个竞品官网的定价页并整理成表格。',
        kind: 'task',
        status: 'failed',
        createdAt: iso(-3 * 36e5),
        updatedAt: iso(-1 * 36e5),
        error: '目标网页连续两次抓取超时',
      },
      {
        ...base,
        id: 'task-notes',
        title: '会议纪要归档',
        prompt: '把本周的会议纪要归档到 notes/meetings/ 目录。',
        kind: 'task',
        status: 'succeeded',
        createdAt: iso(-2 * 864e5),
        updatedAt: iso(-2 * 864e5 + 12 * 60e3),
        result: '已归档 3 份纪要到 notes/meetings/。',
      },
    ];

    this.goals = [
      {
        id: 'goal-mobile',
        title: '完成移动端 v1',
        description: '聊天、任务、目标、应用四个主 tab 可日常使用。',
        category: 'product',
        status: 'active',
        milestones: [
          { id: 'g1m1', title: '组件原语库与骨架', done: true, doneAt: iso(-3 * 864e5) },
          { id: 'g1m2', title: '聊天主链路（流式+工具卡）', done: true, doneAt: iso(-864e5) },
          { id: 'g1m3', title: '工作台三页与审批', done: false },
          { id: 'g1m4', title: 'Android 冒烟', done: false },
        ],
        createdAt: iso(-5 * 864e5),
        updatedAt: iso(-864e5),
      },
      {
        id: 'goal-fitness',
        title: '每周运动三次',
        description: '周一/三/五 晚上各 30 分钟。',
        category: 'fitness',
        status: 'paused',
        milestones: [],
        createdAt: iso(-9 * 864e5),
        updatedAt: iso(-4 * 864e5),
      },
    ];

    this.monitors = [
      {
        id: 'mon-pricing',
        title: '竞品定价页',
        url: 'https://example.com/pricing',
        condition: 'change',
        intervalMinutes: 30,
        status: 'active',
        createdAt: iso(-8 * 864e5),
        lastCheckedAt: iso(-20 * 60e3),
        checks: 42,
      },
      {
        id: 'mon-release',
        title: '版本文档关键词',
        url: 'https://example.com/changelog',
        condition: 'contains',
        value: '正式发布',
        intervalMinutes: 60,
        status: 'paused',
        createdAt: iso(-15 * 864e5),
        lastCheckedAt: iso(-3 * 864e5),
        checks: 7,
      },
    ];

    this.memories = [
      { id: 'mem-1', text: '我喜欢早起，7 点前效率最高。', source: '对话', createdAt: iso(-8 * 864e5), updatedAt: iso(-8 * 864e5) },
      { id: 'mem-2', text: '通勤时听播客，偏好科技与商业类。', source: '对话', createdAt: iso(-6 * 864e5), updatedAt: iso(-6 * 864e5) },
      { id: 'mem-3', text: '乳糖不耐，咖啡不要加奶。', source: 'Apps UI', createdAt: iso(-2 * 864e5), updatedAt: iso(-2 * 864e5) },
    ];

    this.notifications = [
      {
        id: 'act-1',
        kind: 'file_write',
        title: '写入 notes.md',
        payload: { content: '# 今日待办\n- 完成组件库\n- 联调 mock\n（内容截断预览）' },
        status: 'pending',
        createdAt: iso(-4 * 60e3),
      },
      {
        id: 'act-2',
        kind: 'file_edit',
        title: '编辑 profile.md',
        payload: { before: '每周运动三次（草稿）', after: '每周运动三次，周一/三/五晚（定稿）' },
        status: 'pending',
        createdAt: iso(-9 * 60e3),
      },
      {
        id: 'act-3',
        kind: 'file_write',
        title: '写入 weekly.md',
        payload: { content: '上周关键事件 12 条…' },
        status: 'approved',
        createdAt: iso(-2 * 864e5),
        decidedAt: iso(-2 * 864e5 + 60e3),
      },
    ];

    this.identity = { name: 'Pagent', tone: 'warm', showChatUpdates: true };
    this.profile = {
      soul: '你是 Pagent，一个务实、克制的个人助理。回答先给结论，再给依据。',
      user: '软件工程师，早起型，喜欢简洁的中文表达。',
    };
  }

  // --- 会话 ---

  async createSession(accessKey?: string): Promise<{ token: string; mode: string }> {
    await sleep(300);
    if (accessKey === 'wrong') {
      throw new ApiError(401, '访问密钥不正确（mock）');
    }
    return { token: `mock-token-${Date.now()}`, mode: 'mock' };
  }

  async listThreads(): Promise<ThreadInfo[]> {
    await sleep(150);
    return [...this.threads];
  }

  async getConversation(threadId: string): Promise<{ revision: string; messages: ConversationMessage[] }> {
    await sleep(150);
    const history = this.conversations.get(threadId);
    if (!history?.length) return { revision: 'empty', messages: [] };
    // 历史是 mock 内部权威状态；返回副本，防止页面直接改写会话或工具投影。
    return {
      revision: this.conversationRevision(threadId),
      messages: history.map((m) => ({ ...m, toolCalls: m.toolCalls?.map((c) => ({ ...c })) })),
    };
  }

  async runAgent(
    input: RunInput,
    onEvent: (event: AgUiEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const threadId = input.threadId;
    // expectedRevision 是本轮唯一允许追加的位置：拒绝旧快照，且不从客户端重放历史。
    if (input.expectedRevision !== this.conversationRevision(threadId)) {
      throw new ApiError(409, '会话版本冲突（mock）');
    }
    const script = scriptFor(input.message.content);
    this.activeRuns.set(threadId, input.runId);
    this.abortedRuns.delete(input.runId);

    const emit = async (event: AgUiEvent, ms = 60) => {
      const ensureRunIsActive = () => {
        if (signal?.aborted || this.abortedRuns.has(input.runId)) {
          if (this.activeRuns.get(threadId) === input.runId) this.activeRuns.delete(threadId);
          throw new ApiError(0, '已停止');
        }
      };
      ensureRunIsActive();
      await sleep(ms);
      // sleep 期间可能收到 Stop；发事件前再次检查，避免停止后仍向界面写入迟到增量。
      ensureRunIsActive();
      if (this.activeRuns.get(threadId) !== input.runId) {
        throw new ApiError(0, '已停止');
      }
      onEvent(event);
    };

    await emit({ type: 'RUN_STARTED', threadId, runId: input.runId }, 200);

    const intro = script.tool ? '我先查一下……' : '';
    if (intro) {
      const messageId = `msg-${Date.now()}`;
      await emit({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' });
      for (const char of intro) {
        await emit({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: char }, 18);
      }
      await emit({ type: 'TEXT_MESSAGE_END', messageId });
    }

    if (script.tool) {
      const toolCallId = `call-${Date.now()}`;
      await emit({ type: 'TOOL_CALL_START', toolCallId, toolCallName: script.tool.name }, 250);
      for (let i = 0; i < script.tool.args.length; i += 12) {
        await emit({ type: 'TOOL_CALL_ARGS', toolCallId, delta: script.tool.args.slice(i, i + 12) }, 30);
      }
      await emit({ type: 'TOOL_CALL_END', toolCallId });
      await emit({ type: 'TOOL_CALL_RESULT', toolCallId, content: script.tool.result }, 500);
    }

    const messageId = `msg-${Date.now()}-2`;
    await emit({ type: 'TEXT_MESSAGE_START', messageId, role: 'assistant' });
    for (const char of script.reply) {
      await emit({ type: 'TEXT_MESSAGE_CONTENT', messageId, delta: char }, 16);
    }
    await emit({ type: 'TEXT_MESSAGE_END', messageId });
    await emit({ type: 'RUN_FINISHED', threadId, runId: input.runId });
    if (this.activeRuns.get(threadId) === input.runId) this.activeRuns.delete(threadId);

    // 运行成功后落权威历史（含工具投影），模拟真实服务端行为
    const history = this.conversations.get(threadId) ?? [];
    history.push({ id: input.message.id, role: 'user', content: input.message.content });
    if (intro) history.push({ id: messageId + '-i', role: 'assistant', content: intro });
    if (script.tool) {
      history.push({
        id: `a-${input.runId}`,
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: `call-${input.runId}`, type: 'function', function: { name: script.tool.name, arguments: script.tool.args } },
        ],
      });
      history.push({ id: `t-${input.runId}`, role: 'tool', content: script.tool.result, toolCallId: `call-${input.runId}` });
    }
    history.push({ id: messageId, role: 'assistant', content: script.reply });
    this.conversations.set(threadId, history);
    this.conversationRevisions.set(threadId, (this.conversationRevisions.get(threadId) ?? 0) + 1);
  }

  async stopRun(threadId: string, runId: string): Promise<boolean> {
    if (this.activeRuns.get(threadId) !== runId) return false;
    this.abortedRuns.add(runId);
    this.activeRuns.delete(threadId);
    return true;
  }

  // --- 快照 ---

  async getSnapshot(): Promise<WorkspaceSnapshot> {
    await sleep(120);
    return {
      tasks: this.tasks
        .map((task) => this.strip(task))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      goals: [...this.goals],
      monitors: [...this.monitors],
      memories: [...this.memories],
      // 此 notifications 是客户端为统一 UI 合成的视图，不属于 GET /api/agent 返回字段。
      notifications: [...this.notifications],
      identity: { ...this.identity },
      worker: { running: true },
    };
  }

  // --- 任务 ---

  async createTask(prompt: string, title?: string): Promise<AgentTask> {
    await sleep(250);
    const task: AgentTask & { events?: TaskEvent[] } = {
      id: uid('task'),
      title: title || prompt.slice(0, 20),
      prompt,
      kind: 'task',
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: null,
      events: [{ id: uid('e'), taskId: '', date: new Date().toISOString(), kind: 'status', title: '任务已排队', detail: '等待 worker 空闲后执行。' }],
    };
    task.events![0]!.taskId = task.id;
    this.tasks.unshift(task);
    return this.strip(task);
  }

  async getTask(id: string): Promise<TaskDetails> {
    await sleep(150);
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new ApiError(404, '任务不存在（mock）');
    return { task: this.strip(task), events: (task.events ?? []).map((event) => ({ ...event })) };
  }

  async controlTask(
    id: string,
    action: TaskAction,
    target: TaskControlTarget,
  ): Promise<AgentTask> {
    await sleep(250);
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new ApiError(404, '任务不存在（mock）');
    if (target !== task.kind) throw new ApiError(400, '任务控制 target 与任务类型不匹配（mock）');
    // 后台任务只接受 cancel/retry，定时 job 则接受 pause/resume/cancel。
    const allowed = task.kind === 'task' ? ['cancel', 'retry'] : ['pause', 'resume', 'cancel'];
    if (!allowed.includes(action)) throw new ApiError(400, '当前任务类型不支持此控制动作（mock）');
    if (action === 'pause') task.status = 'paused';
    if (action === 'resume') task.status = 'scheduled';
    if (action === 'cancel') task.status = 'cancelled';
    if (action === 'retry') task.status = 'queued';
    if (action === 'cancel') task.error = null;
    task.updatedAt = new Date().toISOString();
    return this.strip(task);
  }

  // --- 监控 ---

  async controlMonitor(id: string, action: MonitorAction): Promise<Monitor> {
    await sleep(250);
    const monitor = this.monitors.find((m) => m.id === id);
    if (!monitor) throw new ApiError(404, '监控不存在（mock）');
    if (action === 'stop') monitor.status = 'stopped';
    if (action === 'pause') monitor.status = 'paused';
    if (action === 'resume') monitor.status = 'active';
    return { ...monitor };
  }

  // --- 审批 ---

  async decideAction(id: string, decision: ApprovalDecision): Promise<ApprovalNotification> {
    await sleep(250);
    const item = this.notifications.find((n) => n.id === id);
    if (!item) throw new ApiError(404, '审批不存在（mock）');
    if (item.status !== 'pending') {
      // 对齐服务端：只有 pending 可决定，重复决定 409
      throw new ApiError(409, '该审批已处理过');
    }
    item.status = decision === 'approve' ? 'approved' : 'denied';
    item.decidedAt = new Date().toISOString();
    return { ...item };
  }

  // --- 目标 ---

  async createGoal(input: GoalInput): Promise<Goal> {
    await sleep(250);
    const now = new Date().toISOString();
    const goal: Goal = {
      id: uid('goal'),
      title: input.title,
      description: input.description ?? '',
      category: input.category || 'general',
      status: 'active',
      milestones: (input.milestones ?? []).map((title) => ({
        id: uid('m'),
        title,
        done: false,
      })),
      createdAt: now,
      updatedAt: now,
    };
    this.goals = [goal, ...this.goals];
    return { ...goal, milestones: goal.milestones.map((m) => ({ ...m })) };
  }

  async updateGoal(id: string, input: Partial<Omit<GoalInput, 'milestones'>>): Promise<Goal> {
    await sleep(250);
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) throw new ApiError(404, '目标不存在（mock）');
    if (input.title !== undefined) goal.title = input.title;
    if (input.description !== undefined) goal.description = input.description;
    if (input.category !== undefined) goal.category = input.category;
    goal.updatedAt = new Date().toISOString();
    return this.copyGoal(goal);
  }

  async setGoalStatus(id: string, status: GoalStatus): Promise<Goal> {
    await sleep(250);
    const goal = this.goals.find((g) => g.id === id);
    if (!goal) throw new ApiError(404, '目标不存在（mock）');
    goal.status = status;
    // 对齐服务端：completed 自动勾掉全部里程碑
    if (status === 'completed') {
      const now = new Date().toISOString();
      for (const m of goal.milestones) {
        if (!m.done) {
          m.done = true;
          m.doneAt = now;
        }
      }
    }
    goal.updatedAt = new Date().toISOString();
    return this.copyGoal(goal);
  }

  async toggleMilestone(goalId: string, milestoneId: string): Promise<Goal> {
    await sleep(200);
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) throw new ApiError(404, '目标不存在（mock）');
    const milestone = goal.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new ApiError(404, '里程碑不存在（mock）');
    milestone.done = !milestone.done;
    milestone.doneAt = milestone.done ? new Date().toISOString() : undefined;
    goal.updatedAt = milestone.doneAt ?? new Date().toISOString();
    return this.copyGoal(goal);
  }

  async removeGoal(id: string): Promise<void> {
    await sleep(250);
    this.goals = this.goals.filter((g) => g.id !== id);
  }

  // --- 身份 / 记忆 / 人设 ---

  async saveIdentity(input: IdentityInput): Promise<Identity> {
    await sleep(250);
    this.identity = { ...this.identity, ...input };
    return { ...this.identity };
  }

  async addMemory(text: string, source?: string): Promise<MemoryItem> {
    await sleep(250);
    const now = new Date().toISOString();
    const item: MemoryItem = { id: uid('mem'), text, source: source ?? 'Apps UI', createdAt: now, updatedAt: now };
    this.memories = [item, ...this.memories];
    return { ...item };
  }

  async editMemory(id: string, text: string): Promise<MemoryItem> {
    await sleep(250);
    const item = this.memories.find((m) => m.id === id);
    if (!item) throw new ApiError(404, '记忆不存在（mock）');
    item.text = text;
    item.updatedAt = new Date().toISOString();
    return { ...item };
  }

  async forgetMemory(id: string): Promise<void> {
    await sleep(250);
    this.memories = this.memories.filter((m) => m.id !== id);
  }

  async getProfile(): Promise<Profile> {
    await sleep(150);
    return { ...this.profile };
  }

  async saveProfile(profile: Profile): Promise<Profile> {
    await sleep(250);
    this.profile = { ...profile };
    return { ...this.profile };
  }

  // --- 内部工具 ---

  /** 快照里的任务不暴露 events（对齐 GET /api/agent 的形状） */
  private strip(task: AgentTask & { events?: TaskEvent[] }): AgentTask {
    const { events: _events, ...rest } = task;
    void _events;
    return { ...rest };
  }

  /** 空历史返回协议哨兵；非空历史以单调计数表达 mock 版本。 */
  private conversationRevision(threadId: string): string {
    const history = this.conversations.get(threadId);
    if (!history?.length) return 'empty';
    return `mock-${this.conversationRevisions.get(threadId) ?? 1}`;
  }

  private copyGoal(goal: Goal): Goal {
    return { ...goal, milestones: goal.milestones.map((m) => ({ ...m })) };
  }
}
