import { Text, View } from 'react-native';
import { Button } from '../ui/Buttons';
import { colors, radius, spacing, typography } from '../ui/tokens';
import { useServiceConnection } from './ConnectionProvider';

export function ConnectionBanner() {
  const connection = useServiceConnection();
  if (!connection || !['offline', 'connecting'].includes(connection.snapshot.status)) return null;
  const { snapshot, retry, changeServer } = connection;
  return (
    <View accessibilityRole="alert" style={{ marginHorizontal: spacing[20], marginBottom: spacing.sm, padding: spacing.md, borderRadius: radius.notice, backgroundColor: colors.waiting, gap: spacing.sm }}>
      <Text style={{ ...typography.muted, color: colors.ink }}>{snapshot.status === 'connecting' ? '正在连接当前服务器…' : '服务器连接失败，现有数据与凭证已保留'}</Text>
      {!!snapshot.error && <Text style={{ ...typography.small, color: colors.muted }}>{snapshot.error}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button small busy={snapshot.busy} onPress={retry}>重试连接</Button>
        <Button small onPress={changeServer}>更改服务器</Button>
      </View>
    </View>
  );
}
