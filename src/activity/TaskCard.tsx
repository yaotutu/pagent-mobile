import { ChevronRight, Clock, ListChecks } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AgentTask } from '../api/types';
import { timeAgo } from '../shared/format';
import { StatusBadge } from '../shared/StatusBadge';
import { IconBox } from '../ui/Surfaces';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function TaskCard({ task, onOpen }: { task: AgentTask; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <IconBox icon={task.kind === 'job' ? Clock : ListChecks} size={sizing[34]} tint={task.status === 'failed' ? colors.dangerBg : task.status === 'succeeded' ? colors.successBg : colors.sky} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Text style={{ ...typography.text, fontWeight: '600', color: colors.ink }} numberOfLines={2}>{task.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' }}>
          <StatusBadge status={task.status} />
          <Text style={{ ...typography.small, color: colors.muted }}>{task.kind === 'job' ? '定时' : '后台'} · {timeAgo(task.updatedAt)}</Text>
        </View>
        {!!(task.error ?? task.result) && <Text style={{ ...typography.small, color: task.error ? colors.danger : colors.muted }} numberOfLines={1}>{task.error ?? task.result}</Text>}
      </View>
      <ChevronRight size={sizing[18]} color={colors.muted} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.bubble, backgroundColor: colors.bubbleAssistant, minHeight: sizing[76] },
});
