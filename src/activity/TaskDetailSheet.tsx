/**
 * 弹层：任务详情与执行时间线。
 *
 * 并发边界：时间线结果绑定「任务版本（updatedAt）+ 重试次数 + api 实例」，
 * 不用 effect 同步清空 state，版本不符即视为仍在加载；effect 内的 alive 标志
 * 让迟到响应无法覆盖新版本，防止快照轮询后闪回旧时间线。
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import { timeAgo } from '../shared/format';
import type { TaskAction } from '../api/contracts';
import { taskActions } from './task-presentation';
import type { AgentTask } from '../api/types';
import { Button } from '../ui/Buttons';
import { Chip } from '../ui/Surfaces';
import { ErrorNotice } from '../ui/Feedback';
import { Sheet } from '../ui/Sheet';
import { StatusBadge } from '../shared/StatusBadge';
import { colors, spacing, typography } from '../ui/tokens';

export function TaskDetailSheet({ task, onClose, busy, error, onControl, onAdvance }: { task: AgentTask; onClose: () => void; busy?: boolean; error?: string; onControl: (action: TaskAction) => void; onAdvance?: () => void }) {
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
        <ErrorNotice error={error} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{taskActions(task).map(({ action, label, danger }) => <Button key={action} small danger={danger} busy={busy} onPress={() => onControl(action)}>{label}</Button>)}</View>
        {onAdvance && task.kind === 'task' && ['queued', 'running'].includes(task.status) && <Button small onPress={onAdvance}>演示：{task.status === 'queued' ? '开始执行' : '推进至完成'}</Button>}
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
  detailBlock: { gap: spacing[5] },
  detailLabel: { ...typography.label, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
});
