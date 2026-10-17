import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

const SUGGESTIONS = ['搜一下 pi muse', '记住我喜欢早起', '把待办写入 notes.md'];

/** 空态：大标题 + 建议 prompt */
export function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing[48] }}>
      <Text style={{ ...typography.empty, fontWeight: '600', color: colors.ink }}>
        今天想做什么？
      </Text>
      {SUGGESTIONS.map((text) => (
        <Pressable
          key={text}
          accessibilityRole="button"
          onPress={() => onPick(text)}
          style={({ pressed }) => [
            styles.suggestion,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={{ ...typography.muted, color: colors.muted }}>{text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestion: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing[9],
  },
});
