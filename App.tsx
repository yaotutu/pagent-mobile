import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from './src/ui/tokens';

/**
 * 初始化占位屏：仅验证工程与设计 token 生效，无任何业务功能。
 * 接手后按 docs/HANDOFF.md 的阶段计划替换为正式骨架
 * （tab 状态机 + 顶栏 + Sheet 层 + 登录门）。
 */
export default function App() {
  return (
    <View style={styles.canvas}>
      <Text style={styles.title}>Pagent</Text>
      <Text style={styles.subtitle}>工程初始化完成，见 docs/HANDOFF.md</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.muted,
    color: colors.muted,
  },
});
