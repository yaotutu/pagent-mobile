/**
 * 监控卡：一条网页监控的条件摘要与暂停/恢复/停止控制。
 *
 * 职责边界：监控的创建走聊天 monitor 工具（技术定稿），本卡片只展示快照并派发控制意图；
 * 请求与操作锁由 ActivityScreen 统一持有。
 */

import { Globe, Pause, Play, Square } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { MonitorAction } from '../api/contracts';
import { timeAgo } from '../shared/format';
import type { Monitor } from '../api/types';
import { Button } from '../ui/Buttons';
import { Card, IconBox } from '../ui/Surfaces';
import { ErrorNotice } from '../ui/Feedback';
import { StatusBadge } from '../shared/StatusBadge';
import { colors, spacing, typography } from '../ui/tokens';

export function MonitorCard({
  monitor,
  busy,
  onControl,
}: {
  monitor: Monitor;
  busy?: boolean;
  onControl: (action: MonitorAction) => void;
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
