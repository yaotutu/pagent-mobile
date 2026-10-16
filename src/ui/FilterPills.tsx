import { Pressable, ScrollView, Text } from 'react-native';
import { colors, radius, sizing, spacing, typography } from './tokens';

export function FilterPills<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {options.map((option) => (
        <Pressable key={option.value} accessibilityRole="button" aria-pressed={option.value === value} onPress={() => onChange(option.value)}
          style={{ minHeight: sizing[38], paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: option.value === value ? colors.bubbleUser : colors.subtle }}>
          <Text style={{ ...typography.muted, fontWeight: '600', color: colors.ink }}>{option.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
