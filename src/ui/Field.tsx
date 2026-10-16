/**
 * 表单字段原语：标签 + 输入框纵向排布；字段间距由使用方容器 gap 控制。
 */

import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, sizing, spacing, typography } from './tokens';

/** 带标签的表单输入框：登录门、目标编辑、记忆编辑等表单统一用它。 */
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={[typography.small, { fontWeight: '600', color: colors.ink }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: sizing[120], textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[7], marginBottom: spacing.lg },
  input: {
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: typography.chat.fontSize,
    backgroundColor: colors.card,
    minHeight: sizing.inputMinHeight,
  },
});
