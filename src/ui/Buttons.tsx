/**
 * 按钮原语。纯交互/纯展示：不持有业务状态，不发请求。
 * 视觉对照 OpenMuse ui.tsx，尺寸与色值一律取自 ./tokens。
 */

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors, radius, sizing, spacing, typography } from './tokens';

/** 主按钮（浅蓝底）/ 次按钮（灰底）通用原语；danger 只换文字与图标色。 */
export function Button({
  children,
  onPress,
  icon: Icon,
  primary,
  disabled,
  busy,
  small,
  danger,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  icon?: LucideIcon;
  /** 主形态：bubbleUser 底色 */
  primary?: boolean;
  disabled?: boolean;
  /** 忙态：图标位换成 spinner 并禁点 */
  busy?: boolean;
  small?: boolean;
  danger?: boolean;
  style?: ViewStyle;
}) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      aria-disabled={!!(disabled || busy)} aria-busy={!!busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? colors.bubbleUser : colors.subtle },
        small && styles.buttonSmall,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : Icon ? (
        <Icon size={sizing[15]} color={color} />
      ) : null}
      <Text style={[styles.buttonText, { color }]}>{children}</Text>
    </Pressable>
  );
}

/** 44×44 圆形图标按钮：顶栏动作、Sheet 关闭等命中区敏感的位置用。 */
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  /** 无障碍标签（盲用读屏依赖，必填） */
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.line : colors.card },
      ]}
    >
      <Icon size={sizing[20]} strokeWidth={1.8} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Button 底座：胶囊形，内容横排居中 */
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing[17],
    minHeight: sizing[42],
    paddingVertical: spacing[10],
    borderRadius: radius.button,
  },
  buttonSmall: { minHeight: sizing[38], paddingVertical: spacing[7], paddingHorizontal: spacing[13] },
  buttonText: { ...typography.button, fontWeight: '600' },
  /** IconButton：44×44 正圆命中区（触控最小尺寸），白底压下变灰 */
  iconButton: {
    width: sizing.touchTarget,
    height: sizing.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius[22],
  },
});
