/**
 * 目标页：目标 CRUD + 里程碑勾选 + 进度条。
 *
 * 协议约束（对齐 openapi）：
 * - 全部里程碑勾完不自动完成——完成必须显式走 status 端点；
 * - completed 会自动勾掉全部里程碑，重新激活不回退勾选记录；
 * - 编辑端点不含里程碑（里程碑只随创建提交、之后仅可勾选）。
 */

import { Pencil, Plus, SquareCheck, Trash2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '../lib/api-context';
import type { GoalInput } from '../lib/api';
import { timeAgo } from '../lib/format';
import type { Goal, GoalStatus, WorkspaceSnapshot } from '../lib/types';
import {
  Button,
  Card,
  CheckRow,
  Chip,
  Empty,
  ErrorNotice,
  Field,
  SectionHeading,
  Sheet,
  StatusBadge,
} from '../ui/components';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function GoalsScreen({
  snapshot,
  refresh,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  refresh: () => void;
}) {
  const api = useApi();
  const goals = snapshot?.goals ?? [];
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal>();
  const [confirmRemove, setConfirmRemove] = useState<Goal>();
  const inFlight = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();

  const run = async (id: string, action: () => Promise<unknown>) => {
    // toggle 不是幂等写入：同一目标的里程碑/状态请求串行化，避免连点翻回原值。
    // ref 在下一次渲染前就生效；按目标加锁，其他目标仍可独立操作。
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setBusyIds(new Set(inFlight.current));
    setError(undefined);
    try {
      await action();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current.delete(id);
      setBusyIds(new Set(inFlight.current));
    }
  };

  return (
    <View style={{ gap: spacing[18] }}>
      <SectionHeading title="目标" action="新建" onPress={() => setCreating(true)} />
      <ErrorNotice error={error} />
      {goals.length === 0 ? (
        <Empty
          icon={SquareCheck}
          title="还没有目标"
          detail="创建一个目标，助手会在规划类回答中引用它的进度。"
        />
      ) : (
        goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            busy={busyIds.has(goal.id)}
            onToggle={(mid) => void run(goal.id, () => api.toggleMilestone(goal.id, mid))}
            onStatus={(status) => void run(goal.id, () => api.setGoalStatus(goal.id, status))}
            onEdit={() => setEditing(goal)}
            onRemove={() => setConfirmRemove(goal)}
          />
        ))
      )}

      {creating && (
        <GoalFormSheet
          title="新建目标"
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            await api.createGoal(input);
            setCreating(false);
            refresh();
          }}
        />
      )}
      {editing && (
        <GoalFormSheet
          title="编辑目标"
          goal={editing}
          onClose={() => setEditing(undefined)}
          onSubmit={async (input) => {
            await api.updateGoal(editing.id, input);
            setEditing(undefined);
            refresh();
          }}
        />
      )}
      {confirmRemove && (
        <Sheet title="删除目标" subtitle={confirmRemove.title} onClose={() => setConfirmRemove(undefined)}>
          <View style={{ gap: spacing[14] }}>
            <Text style={{ ...typography.muted, color: colors.muted }}>
              删除后不可恢复，里程碑记录一并清除。
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
              <Button onPress={() => setConfirmRemove(undefined)}>取消</Button>
              <Button
                danger
                icon={Trash2}
                busy={busyIds.has(confirmRemove.id)}
                onPress={() =>
                  void run(confirmRemove.id, async () => {
                    await api.removeGoal(confirmRemove.id);
                    setConfirmRemove(undefined);
                  })
                }
              >
                删除
              </Button>
            </View>
          </View>
        </Sheet>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 目标卡
// ---------------------------------------------------------------------------

function GoalCard({
  goal,
  busy,
  onToggle,
  onStatus,
  onEdit,
  onRemove,
}: {
  goal: Goal;
  busy?: boolean;
  onToggle: (milestoneId: string) => void;
  onStatus: (status: GoalStatus) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const done = goal.milestones.filter((m) => m.done).length;
  const total = goal.milestones.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  /** 状态迁移入口：active→暂停/完成；paused→激活；completed/archived→重新激活 */
  const transitions: { label: string; status: GoalStatus }[] =
    goal.status === 'active'
      ? [
          { label: '暂停', status: 'paused' },
          { label: '完成', status: 'completed' },
        ]
      : goal.status === 'paused'
        ? [{ label: '激活', status: 'active' }]
        : [{ label: '重新激活', status: 'active' }];

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing[10] }}>
        <View style={{ flex: 1, gap: spacing[5] }}>
          <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>
            {goal.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <StatusBadge status={goal.status} />
            {goal.category ? <Chip>{goal.category}</Chip> : null}
            <Text style={{ ...typography.small, color: colors.muted }}>
              {total ? `${done}/${total} 里程碑` : '无里程碑'}
            </Text>
          </View>
        </View>
        <Button small icon={Pencil} onPress={onEdit}>
          编辑
        </Button>
      </View>

      {goal.description ? (
        <Text style={{ ...typography.muted, color: colors.muted }} numberOfLines={2}>
          {goal.description}
        </Text>
      ) : null}

      {total > 0 && (
        <View style={{ gap: spacing[9] }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          {goal.milestones.map((m) => (
            <CheckRow key={m.id} label={m.title} checked={m.done} onPress={() => {
              if (!busy) onToggle(m.id);
            }} />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ ...typography.small, color: colors.muted }}>更新于 {timeAgo(goal.updatedAt)}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {transitions.map(({ label, status }) => (
            <Button key={status} small busy={busy} onPress={() => onStatus(status)}>
              {label}
            </Button>
          ))}
          <Button small danger icon={Trash2} onPress={onRemove}>
            删除
          </Button>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 新建/编辑表单 Sheet（编辑态不出现里程碑字段：协议只允许创建时提交）
// ---------------------------------------------------------------------------

function GoalFormSheet({
  title,
  goal,
  onClose,
  onSubmit,
}: {
  title: string;
  goal?: Goal;
  onClose: () => void;
  onSubmit: (input: GoalInput) => Promise<void>;
}) {
  const [form, setForm] = useState<GoalInput>({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    category: goal?.category ?? '',
    milestones: [],
  });
  const [milestonesText, setMilestonesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Sheet title={title} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <ErrorNotice error={error} />
        <Field
          label="目标标题"
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="例如：完成移动端 v1"
        />
        <Field
          label="描述（可选）"
          value={form.description}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="一两句话说清这个目标"
          multiline
        />
        <Field
          label="分类（可选）"
          value={form.category}
          onChangeText={(category) => setForm((f) => ({ ...f, category }))}
          placeholder="如 fitness / study / product"
        />
        {!goal && (
          <Field
            label="里程碑（可选，每行一个）"
            value={milestonesText}
            onChangeText={setMilestonesText}
            placeholder={'组件库\n聊天链路\nAndroid 冒烟'}
            multiline
          />
        )}
        <Button
          primary
          icon={Plus}
          busy={busy}
          onPress={async () => {
            if (!form.title.trim()) {
              setError('目标标题不能为空');
              return;
            }
            setBusy(true);
            setError(undefined);
            try {
              await onSubmit({
                ...form,
                title: form.title.trim(),
                milestones: goal
                  ? undefined
                  : milestonesText
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
            }
          }}
        >
          保存
        </Button>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  progressTrack: { height: sizing[4], borderRadius: radius[4], backgroundColor: colors.line },
  progressFill: { height: sizing[4], borderRadius: radius[4], backgroundColor: colors.progressFill },
});
