// 按目标加同步锁；完成必须显式提交，勾完里程碑不自动变更目标状态。

import { ChevronRight, CircleDollarSign, Heart, Square, SquareCheck, Target, Users } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import type { Goal, GoalStatus, WorkspaceSnapshot } from '../api/types';
import { Empty, ErrorNotice } from '../ui/Feedback';
import { Chip } from '../ui/Surfaces';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';
import { goalCategoryLabel } from './presentation';
import { GoalDetailSheet } from './GoalDetailSheet';
import { GoalFormSheet } from './GoalFormSheet';

/** 列表筛选：当前=进行中与暂停，已完成=completed/archived，全部=不过滤。 */
type Filter = 'current' | 'done' | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'current', label: '当前' },
  { id: 'done', label: '已完成' },
  { id: 'all', label: '全部' },
];

/** 创建入口的分类预填项；category 原样透传给服务端。 */
const CREATE_CATEGORIES: { name: string; category: string; icon: typeof Heart }[] = [
  { name: '健康', category: 'health', icon: Heart },
  { name: '关系', category: 'relationship', icon: Users },
  { name: '财务', category: 'finance', icon: CircleDollarSign },
  { name: '其他', category: 'other', icon: Target },
];

const matches = (goal: Goal, filter: Filter) =>
  filter === 'all'
    ? true
    : filter === 'current'
      ? goal.status === 'active' || goal.status === 'paused'
      : goal.status === 'completed' || goal.status === 'archived';

export function GoalsScreen({
  snapshot,
  refresh,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  refresh: () => void;
}) {
  const api = useApi();
  const goals = snapshot?.goals ?? [];
  const [filter, setFilter] = useState<Filter>('current');
  const [detailId, setDetailId] = useState<string>();
  const [creating, setCreating] = useState<string>();
  const inFlight = useRef(new Set<string>());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();

  // ref 锁在渲染前生效；失败继续抛给表单，以保留输入与弹层。
  const perform = async (id: string, action: () => Promise<unknown>) => {
    if (inFlight.current.has(id)) throw new Error('操作进行中，请稍候');
    inFlight.current.add(id);
    setBusyIds(new Set(inFlight.current));
    setError(undefined);
    try {
      await action();
      refresh();
    } finally {
      inFlight.current.delete(id);
      setBusyIds(new Set(inFlight.current));
    }
  };

  /** 页面内的即发即忘操作（里程碑勾选、状态迁移）：失败落到页面级 ErrorNotice。 */
  const run = (id: string, action: () => Promise<unknown>) => {
    void perform(id, action).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  };

  // 详情内容始终按 id 回查快照：写入后自动反映新状态，删除后详情随之关闭。
  const detail = detailId ? goals.find((goal) => goal.id === detailId) : undefined;
  const visible = goals.filter((goal) => matches(goal, filter));

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={styles.filterRow}>
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              aria-pressed={active}
              onPress={() => setFilter(item.id)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && { color: colors.ink }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ErrorNotice error={error} />

      {visible.length === 0 ? (
        goals.length === 0 ? (
          <Empty
            icon={SquareCheck}
            title="还没有目标"
            detail="从下面挑一个分类，或在聊天里让助手帮你拆解。"
          />
        ) : (
          // 筛选后为空是正常状态，只留一行轻量说明，不占用大块留白。
          <Text style={styles.filterHint}>
            {filter === 'done' ? '还没有已完成的目标。' : '当前没有进行中的目标。'}
          </Text>
        )
      ) : (
        visible.map((goal) => (
          <Pressable
            key={goal.id}
            accessibilityRole="button"
            accessibilityLabel={`打开目标：${goal.title}`}
            onPress={() => setDetailId(goal.id)}
            style={({ pressed }) => [styles.goalRow, pressed && { backgroundColor: colors.canvas }]}
          >
            <Square
              size={sizing[20]}
              color={goal.status === 'completed' ? colors.success : colors.muted}
              fill={goal.status === 'completed' ? colors.success : 'transparent'}
            />
            <View style={styles.goalBody}>
              <Text style={styles.goalTitle} numberOfLines={1}>
                {goal.title}
              </Text>
              <View style={styles.metaRow}>
                {goal.category ? <Chip>{goalCategoryLabel(goal.category)}</Chip> : null}
                <Text style={styles.goalMeta} numberOfLines={1}>
                  {summarize(goal)}
                </Text>
              </View>
            </View>
            <ChevronRight size={sizing.iconMedium} color={colors.muted} />
          </Pressable>
        ))
      )}

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>新建目标</Text>
      {CREATE_CATEGORIES.map((item) => (
        <Pressable
          key={item.name}
          accessibilityRole="button"
          accessibilityLabel={`新建${item.name}目标`}
          onPress={() => setCreating(item.category)}
          style={({ pressed }) => [styles.categoryRow, pressed && { opacity: 0.6 }]}
        >
          <item.icon size={sizing.iconMedium} color={colors.muted} />
          <Text style={styles.categoryText}>{item.name}</Text>
          <ChevronRight size={sizing.iconSmall} color={colors.muted} />
        </Pressable>
      ))}

      {detail && (
        <GoalDetailSheet
          goal={detail}
          error={error}
          busy={busyIds.has(detail.id)}
          onClose={() => setDetailId(undefined)}
          onToggle={(mid) => run(detail.id, () => api.toggleMilestone(detail.id, mid))}
          onStatus={(status: GoalStatus) => run(detail.id, () => api.setGoalStatus(detail.id, status))}
          onEdit={async (input) => {
            await perform(detail.id, () => api.updateGoal(detail.id, input));
          }}
          onRemove={async () => {
            await perform(detail.id, () => api.removeGoal(detail.id));
            setDetailId(undefined);
          }}
        />
      )}

      {creating && (
        <GoalFormSheet
          title="新建目标"
          initialCategory={creating}
          onClose={() => setCreating(undefined)}
          onSubmit={async (input) => {
            await api.createGoal(input);
            setCreating(undefined);
            refresh();
          }}
        />
      )}
    </View>
  );
}

// 列表摘要同时提供进度和下一步，完整内容在详情展示。
function summarize(goal: Goal) {
  const next = goal.milestones.find((m) => !m.done)?.title;
  const done = goal.milestones.filter((m) => m.done).length;
  if (next) return `${done}/${goal.milestones.length} 已完成 · ${next}`;
  const total = goal.milestones.length;
  if (total) return `${total}/${total} 里程碑已完成`;
  return goal.description || '无里程碑';
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  filterPill: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[7],
    borderRadius: radius.pill,
    backgroundColor: colors.subtle,
  },
  filterPillActive: { backgroundColor: colors.bubbleUser },
  filterText: { ...typography.button, fontWeight: '600', color: colors.muted },
  filterHint: { ...typography.muted, color: colors.muted, paddingVertical: spacing.sm },

  // 列表行：OpenMuse 同款左图标 / 中内容 / 右箭头的三段式，不再套卡片。
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.field,
  },
  goalBody: { flex: 1, gap: spacing.xs },
  goalTitle: { ...typography.text, color: colors.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goalMeta: { ...typography.small, color: colors.muted, flexShrink: 1 },

  divider: { height: sizing.borderWidth, backgroundColor: colors.line },
  sectionLabel: { ...typography.label, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: sizing[38] },
  categoryText: { ...typography.text, color: colors.muted, flex: 1 },
});
