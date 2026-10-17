/**
 * 设置页"应用更新"入口卡。纯展示：标题"应用更新"固定，副标题按 status 折叠；点击交由父级打开 UpdateSheet。
 */

import { ChevronRight, Download } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, IconBox } from '../ui/Surfaces';
import { colors, sizing, spacing, typography } from '../ui/tokens';
import type { UpdateSnapshot } from './types';

export function UpdateEntry({
  snapshot,
  onPress,
}: {
  snapshot: UpdateSnapshot;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`应用更新，当前状态：${statusLabel(snapshot)}`}
      onPress={onPress}
      style={styles.pressable}
    >
      <Card>
        <View style={styles.row}>
          <IconBox icon={Download} size={sizing[36]} tint={colors.sky} iconColor={colors.accent} />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text style={styles.title}>应用更新</Text>
            <Text style={styles.subtitle}>{statusLabel(snapshot)}</Text>
          </View>
          <ChevronRight size={sizing[20]} color={colors.muted} />
        </View>
      </Card>
    </Pressable>
  );
}

function statusLabel(snapshot: UpdateSnapshot): string {
  const current = snapshot.currentVersion ? `当前版本 ${snapshot.currentVersion}` : '当前版本未知';
  switch (snapshot.status) {
    case 'unsupported':
      return '当前环境不支持自动更新';
    case 'idle':
      return `${current} · 轻点检查更新`;
    case 'checking':
      return `${current} · 正在检查更新`;
    case 'current':
      return `${current} · 已是最新`;
    case 'downloading': {
      const mb = (snapshot.bytesWritten / (1024 * 1024)).toFixed(1);
      return `${current} · 正在下载 ${mb} MB`;
    }
    case 'ready':
      return `${current} · 安装包已就绪`;
    case 'installing':
      return `${current} · 正在请求系统安装`;
    case 'cancelled':
      return `${current} · 已取消本次下载`;
    case 'error':
      return `${current} · 更新出错`;
  }
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 23 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: { ...typography.text, color: colors.ink },
  subtitle: { ...typography.small, color: colors.muted },
});
