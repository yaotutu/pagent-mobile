/**
 * 任务页：后台+定时任务混合列表（状态徽章/控制/详情）与网页监控区块。
 *
 * 数据契约（对齐 openapi）：
 * - 快照 tasks 混合 kind=job（定时）|task（后台），按 updatedAt 倒序；
 * - 控制请求必须显式发送与任务 kind 一致的 target；后台任务不提供暂停/恢复；
 * - 监控创建走聊天 monitor 工具（技术定稿），页面只放引导与控制。
 */

import { ChevronDown, ChevronRight, ListChecks, Pause, Play, RotateCcw, Globe, Square, Plus, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../lib/api-context';
import type { TaskAction } from '../lib/api';
import { formatDateTime, timeAgo } from '../lib/format';
import type { AgentTask, Monitor, WorkspaceSnapshot } from '../lib/types';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNotice,
  Field,
  IconBox,
  SectionHeading,
  Sheet,
  StatusBadge,
} from '../ui/components';
import { colors, sizing, spacing, typography } from '../ui/tokens';

export function ActivityScreen({
  snapshot,
  refresh,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  refresh: () => void;
}) {
  const api = useApi();
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const tasks = snapshot?.tasks ?? [];
  const monitors = snapshot?.monitors ?? [];

  const control = async (task: AgentTask, action: TaskAction) => {
    setBusyId(task.id);
    setError(undefined);
    try {
      // API 要求 target 必填且与快照 kind 同义，避免同一任务 ID 被错误分发到另一类控制器。
      await api.controlTask(task.id, action, task.kind);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(undefined);
    }
  };

  const detail = detailId ? tasks.find((t) => t.id === detailId) : undefined;

  return (
    <View style={{ gap: spacing.xl }}>
      <SectionHeading title="后台与定时任务" action="新建" onPress={() => setCreating(true)} />
      <ErrorNotice error={error} />
      {tasks.length === 0 ? (
        <Empty
          icon={ListChecks}
          title="还没有任务"
          detail="在聊天里让助手安排，或点右上角新建一个后台任务。"
        />
      ) : (
        tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onOpen={() => setDetailId(task.id)}
            onControl={(action) => void control(task, action)}
          />
        ))
      )}

      <SectionHeading title="网页监控" />
      {monitors.length === 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.text, color: colors.ink }}>还没有监控</Text>
          <Text style={{ ...typography.muted, color: colors.muted }}>
            在聊天里对我说「帮我监控 example.com 的价格变化」，即可创建网页监控；命中后会主动通知你。
          </Text>
        </Card>
      ) : (
        monitors.map((monitor) => (
          <MonitorCard
            key={monitor.id}
            monitor={monitor}
            onControl={async (action) => {
              setBusyId(monitor.id);
              try {
                await api.controlMonitor(monitor.id, action);
                refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusyId(undefined);
              }
            }}
            busy={busyId === monitor.id}
          />
        ))
      )}

      {creating && (
        <CreateTaskSheet
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
      {detail && <TaskDetailSheet task={detail} onClose={() => setDetailId(undefined)} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 任务卡与控制
// ---------------------------------------------------------------------------

/** 状态 → 可用控制动作（展示顺序即按钮顺序） */
function taskActions(task: AgentTask): { action: TaskAction; label: string; icon: LucideIcon; danger?: boolean }[] {
  const actions: { action: TaskAction; label: string; icon: LucideIcon; danger?: boolean }[] = [];
  if (task.kind === 'task') {
    // 后台任务只支持取消或失败后重试；暂停/恢复仅适用于可调度的 job。
    if (task.status === 'running' || task.status === 'queued') {
      actions.push({ action: 'cancel', label: '取消', icon: Square, danger: true });
    }
    if (task.status === 'failed') {
      actions.push({ action: 'retry', label: '重试', icon: RotateCcw });
    }
  } else {
    if (task.status === 'running' || task.status === 'queued') {
      actions.push({ action: 'cancel', label: '取消', icon: Square, danger: true });
    }
    if (task.status === 'paused') {
      actions.push({ action: 'resume', label: '恢复', icon: Play });
      actions.push({ action: 'cancel', label: '停止', icon: Square, danger: true });
    }
    if (task.status === 'scheduled' || task.status === 'running') {
      actions.push({ action: 'pause', label: '暂停', icon: Pause });
      if (task.status === 'scheduled') {
        actions.push({ action: 'cancel', label: '停止', icon: Square, danger: true });
      }
    }
  }
  return actions;
}

function TaskCard({
  task,
  busy,
  onOpen,
  onControl,
}: {
  task: AgentTask;
  busy?: boolean;
  onOpen: () => void;
  onControl: (action: TaskAction) => void;
}) {
  const [resultExpanded, setResultExpanded] = useState(false);
  const resultText = task.error ?? task.result;

  return (
    <Card style={{ gap: spacing[11] }}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.row, { gap: spacing[11] }, pressed && { opacity: 0.7 }]}>
        <IconBox
          icon={ListChecks}
          tint={task.status === 'failed' ? colors.dangerBg : task.status === 'succeeded' ? colors.successBg : colors.sky}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
            {task.title}
          </Text>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <StatusBadge status={task.status} />
            <Chip>{task.kind === 'job' ? '定时' : '后台'}</Chip>
            {!!task.nextRunAt && (
              <Text style={{ ...typography.small, color: colors.muted }}>
                下次 {formatDateTime(task.nextRunAt)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
      {resultText && (
        <View style={styles.resultBlock}>
          <Text
            style={{ ...typography.muted, color: task.error ? colors.danger : colors.muted }}
            numberOfLines={resultExpanded ? undefined : 2}
          >
            {resultText}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: resultExpanded }}
            accessibilityLabel={resultExpanded ? '收起任务结果' : '展开任务结果'}
            onPress={() => setResultExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.resultToggle, pressed && { opacity: 0.7 }]}
          >
            {resultExpanded ? <ChevronDown size={sizing[14]} color={colors.muted} /> : <ChevronRight size={sizing[14]} color={colors.muted} />}
            <Text style={{ ...typography.small, color: colors.muted }}>
              {resultExpanded ? '收起' : '展开'}
            </Text>
          </Pressable>
        </View>
      )}
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={{ ...typography.small, color: colors.muted }}>更新于 {timeAgo(task.updatedAt)}</Text>
        <View style={[styles.row, { gap: spacing.sm }]}>
          {taskActions(task).map(({ action, label, icon: Icon, danger }) => (
            <Button
              key={action}
              small
              danger={danger}
              icon={Icon}
              busy={busy}
              onPress={() => onControl(action)}
            >
              {label}
            </Button>
          ))}
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 监控卡
// ---------------------------------------------------------------------------

function MonitorCard({
  monitor,
  busy,
  onControl,
}: {
  monitor: Monitor;
  busy?: boolean;
  onControl: (action: 'pause' | 'resume' | 'stop') => void;
}) {
  const alive = monitor.status === 'active';
  return (
    <Card style={{ gap: spacing[10] }}>
      <View style={[styles.row, { gap: spacing[11] }]}>
        <IconBox icon={Globe} tint={monitor.status === 'active' ? colors.sky : colors.subtle} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
            {monitor.title}
          </Text>
          <Text style={{ ...typography.small, color: colors.muted }} numberOfLines={1}>
            {monitor.url}
          </Text>
        </View>
        <StatusBadge status={monitor.status} />
      </View>
      <Text style={{ ...typography.small, color: colors.muted }}>
        {monitor.condition === 'change'
          ? `页面变化即通知 · 每 ${monitor.intervalMinutes} 分钟`
          : `命中「${monitor.value ?? ''}」通知 · 每 ${monitor.intervalMinutes} 分钟`}
        {` · 已检查 ${monitor.checks} 次`}
        {monitor.lastCheckedAt ? ` · 上次 ${timeAgo(monitor.lastCheckedAt)}` : ''}
      </Text>
      <ErrorNotice error={monitor.error} />
      {monitor.status !== 'stopped' && (
        <View style={[styles.row, { justifyContent: 'flex-end', gap: spacing.sm }]}>
          <Button
            small
            icon={alive ? Pause : Play}
            busy={busy}
            onPress={() => onControl(alive ? 'pause' : 'resume')}
          >
            {alive ? '暂停' : '恢复'}
          </Button>
          <Button small danger icon={Square} busy={busy} onPress={() => onControl('stop')}>
            停止
          </Button>
        </View>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 弹层：新建任务 / 任务详情
// ---------------------------------------------------------------------------

function CreateTaskSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const api = useApi();
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Sheet title="新建后台任务" subtitle="任务将在独立会话中执行，完成后通知你" onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <ErrorNotice error={error} />
        <Field
          label="任务标题（可选）"
          value={title}
          onChangeText={setTitle}
          placeholder="默认截取指令开头"
        />
        <Field
          label="任务指令"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="完整自包含的指令：任务会在独立会话执行，工具可用"
          multiline
        />
        <Button
          primary
          icon={Plus}
          busy={busy}
          onPress={async () => {
            if (!prompt.trim()) {
              setError('任务指令不能为空');
              return;
            }
            setBusy(true);
            setError(undefined);
            try {
              await api.createTask(prompt.trim(), title.trim() || undefined);
              onCreated();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          创建任务
        </Button>
      </View>
    </Sheet>
  );
}

function TaskDetailSheet({ task, onClose }: { task: AgentTask; onClose: () => void }) {
  const api = useApi();
  const [attempt, setAttempt] = useState(0);
  const [timeline, setTimeline] = useState<{
    api: typeof api;
    id: string;
    updatedAt: string;
    attempt: number;
    events?: { date: string; kind: string; title: string; detail: string }[];
    error?: string;
  }>();
  // 请求结果绑定任务版本与重试次数；不通过 effect 同步清空 state，版本不符即加载中。
  // 快照更新会重新读取时间线，旧请求通过 alive 失效，避免迟到结果覆盖新版本。
  const current = timeline?.api === api && timeline.id === task.id &&
    timeline.updatedAt === task.updatedAt && timeline.attempt === attempt ? timeline : undefined;
  const events = current?.events;
  useEffect(() => {
    let alive = true;
    api
      .getTask(task.id)
      .then((detail) => {
        if (alive) setTimeline({ api, id: task.id, updatedAt: task.updatedAt, attempt, events: detail.events });
      })
      .catch((error) => {
        if (alive) setTimeline({ api, id: task.id, updatedAt: task.updatedAt, attempt, error: error instanceof Error ? error.message : String(error) });
      });
    return () => {
      alive = false;
    };
  }, [api, task.id, task.updatedAt, attempt]);

  return (
    <Sheet title={task.title} subtitle={`${task.kind === 'job' ? '定时任务' : '后台任务'} · 更新于 ${timeAgo(task.updatedAt)}`} onClose={onClose}>
      <View style={{ gap: spacing[14] }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <StatusBadge status={task.status} />
          <Chip>{task.kind === 'job' ? '定时' : '后台'}</Chip>
        </View>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>指令</Text>
          <Text style={{ ...typography.muted, color: colors.muted }}>{task.prompt}</Text>
        </View>
        {task.result ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>最近结果</Text>
            <Text style={{ ...typography.muted, color: colors.muted }}>{task.result}</Text>
          </View>
        ) : null}
        {task.error ? (
          <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>错误</Text>
            <Text style={{ ...typography.muted, color: colors.danger }}>{task.error}</Text>
          </View>
        ) : null}
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>时间线</Text>
          {current && events === undefined ? (
            <View>
              <ErrorNotice error={current.error} />
              <Button small onPress={() => setAttempt((previous) => previous + 1)}>重试加载时间线</Button>
            </View>
          ) : events === undefined ? (
            <Text style={{ ...typography.small, color: colors.muted }}>加载中…</Text>
          ) : events.length === 0 ? (
            <Text style={{ ...typography.small, color: colors.muted }}>暂无记录</Text>
          ) : (
            <View style={{ gap: spacing[10] }}>
              {events.map((event, index) => (
                <View key={index} style={{ gap: spacing.xxs }}>
                  <View style={[styles.row, { gap: spacing.sm }]}>
                    <Text style={{ ...typography.small, fontWeight: '600', color: colors.ink }}>
                      {event.title}
                    </Text>
                    <Chip>{event.kind}</Chip>
                  </View>
                  <Text style={{ ...typography.small, color: colors.muted }}>
                    {timeAgo(event.date)} · {event.detail}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // 结果/错误的折叠按钮独立于卡片标题详情入口，避免点击区域互相嵌套。
  resultBlock: { gap: spacing.xs },
  resultToggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing[3] },
  detailBlock: { gap: spacing[5] },
  detailLabel: { ...typography.label, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
});
