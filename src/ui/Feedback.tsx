/**
 * 状态类展示原语：空状态、错误提示条。
 */

import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, sizing, spacing, typography } from './tokens';

/** 空状态：大图标 + 标题 + 说明（+ 可选动作，如"去创建"按钮）。 */
export function Empty({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', padding: spacing[40], gap: spacing[13] }}>
      <View
        style={[
          styles.iconBox,
          { width: sizing[55], height: sizing[55], borderRadius: radius.emptyIcon, backgroundColor: colors.sky },
        ]}
      >
        <Icon size={sizing[24]} color={colors.accent} />
      </View>
      <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>{title}</Text>
      <Text style={{ ...typography.muted, color: colors.muted, textAlign: 'center', maxWidth: layout.emptyTextMaxWidth }}>
        {detail}
      </Text>
      {children}
    </View>
  );
}

/** 错误提示条：error 为空时整体不渲染，调用方只需把错误字符串传进来。 */
export function ErrorNotice({ error }: { error?: string }) {
  return error ? (
    <View accessibilityRole="alert" style={styles.errorNotice}>
      <Text style={{ ...typography.text, color: colors.danger }}>{error}</Text>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.emptyIcon,
  },
  errorNotice: {
    padding: spacing.lg,
    borderRadius: radius.notice,
    backgroundColor: colors.dangerBg,
    marginVertical: spacing[10],
    gap: spacing.xs,
  },
});
