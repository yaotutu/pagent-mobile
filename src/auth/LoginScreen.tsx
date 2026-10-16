import { Bot } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../ui/Buttons';
import { Card, IconBox } from '../ui/Surfaces';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { colors, layout, sizing, spacing, typography } from '../ui/tokens';

export function LoginScreen({ onLogin, onDemo, busy, error }: { onLogin: (accessKey?: string) => void; onDemo: () => void; busy?: boolean; error?: string }) {
  const [accessKey, setAccessKey] = useState('');
  return (
    <SafeAreaView style={styles.loginCanvas}>
      <View style={styles.loginColumn}>
        <IconBox icon={Bot} size={sizing[64]} iconSize={sizing[30]} tint={colors.avatarSky} iconColor={colors.accent} />
        <Text style={styles.loginTitle}>Pagent</Text>
        <Text style={{ ...typography.muted, color: colors.muted, textAlign: 'center' }}>
          你的个人助理工作台
        </Text>
        <Card style={{ width: layout.fullWidth }}>
          <ErrorNotice error={error} />
          <Field
            label="访问密钥（可选）"
            value={accessKey}
            onChangeText={setAccessKey}
            secureTextEntry
            placeholder="回环部署无需密钥"
          />
          <Button primary busy={busy} onPress={() => onLogin(accessKey || undefined)}>
            进入工作台
          </Button>
          <Text style={{ ...typography.small, color: colors.muted, marginTop: spacing[15] }}>
            默认连接本机服务；无密钥部署可直接进入。
          </Text>
        </Card>
        <Button onPress={onDemo} disabled={busy}>体验演示工作区</Button>
        <Text style={{ ...typography.small, color: colors.muted, textAlign: 'center' }}>无需连接服务，所有数据与操作只保存在本次演示中。</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginCanvas: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.section,
  },
  loginColumn: {
    width: layout.fullWidth,
    maxWidth: layout.loginMaxWidth,
    gap: spacing[14],
    alignItems: 'center',
  },
  loginTitle: { ...typography.display, fontWeight: '500', color: colors.ink },

});
