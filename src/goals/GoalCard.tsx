// 状态与里程碑由权威快照提供，卡片仅派发操作意图。

import { goalCategoryLabel } from './presentation';
import { Pencil, Trash2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../shared/format';
import type { Goal, GoalStatus } from '../api/types';
import { Button } from '../ui/Buttons';
import { Chip } from '../ui/Surfaces';
import { CheckRow } from '../ui/Rows';
import { StatusBadge } from '../shared/StatusBadge';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function GoalCard({
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
    <View style={{ gap: spacing.md }}>
      <View style={styles.badgeRow}>
        <StatusBadge status={goal.status} />
        {goal.category ? <Chip>{goalCategoryLabel(goal.category)}</Chip> : null}
        <Text style={{ ...typography.small, color: colors.muted }}>
          {total ? `${done}/${total} 里程碑` : '无里程碑'}
        </Text>
      </View>

      {goal.description ? (
        <Text style={{ ...typography.muted, color: colors.muted }}>
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

      <View style={styles.footerRow}>
        <Text style={{ ...typography.small, color: colors.muted }}>更新于 {timeAgo(goal.updatedAt)}</Text>
        <View style={styles.actionRow}>
          {transitions.map(({ label, status }) => (
            <Button key={status} small busy={busy} onPress={() => onStatus(status)}>
              {label}
            </Button>
          ))}
          <Button small icon={Pencil} onPress={onEdit}>
            编辑
          </Button>
          <Button small danger icon={Trash2} onPress={onRemove}>
            删除
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 卡片内两处横向排布（徽章行 / 底部操作行）共享同一套行布局常量。
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerRow: { gap: spacing.md },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  progressTrack: { height: sizing[4], borderRadius: radius[4], backgroundColor: colors.line },
  progressFill: { height: sizing[4], borderRadius: radius[4], backgroundColor: colors.progressFill },
});
