/**
 * 行状展示原语：区块小标题、勾选行。
 */

import { ArrowUpRight, Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizing, spacing, typography } from './tokens';

/** 区块小标题：全大写 label 样式，右侧可挂一个动作链接（如"全部 / 新建"）。 */
export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[styles.between, { marginBottom: spacing[19] }]}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={[styles.row, { gap: spacing[5] }]}
        >
          <Text style={{ ...typography.small, color: colors.ink }}>{action}</Text>
          <ArrowUpRight size={sizing[13]} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 勾选行：目标里程碑、选项开关等；视觉为方框勾，非 RN Switch。 */
export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      onPress={onPress}
      style={[styles.row, { gap: spacing[10], paddingVertical: spacing[9] }]}
    >
      <View
        style={[
          styles.checkBox,
          {
            borderColor: checked ? colors.ink : colors.line,
            backgroundColor: checked ? colors.ink : colors.card,
          },
        ]}
      >
        {checked && <Check size={sizing[13]} color={colors.card} />}
      </View>
      <Text style={{ ...typography.text, color: colors.ink, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /** 区块标题用 label 样式（pagent 规格定稿） */
  sectionLabel: { ...typography.label, fontWeight: '700', color: colors.muted },
  checkBox: {
    width: sizing[19],
    height: sizing[19],
    borderRadius: radius.checkRow,
    borderWidth: sizing.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
