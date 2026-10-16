import { ArrowUp, Square } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { colors, radius, shadows, sizing, spacing, typography } from '../ui/tokens';

export function ChatComposer({ input, setInput, running, loading, historyFailed, error, reload, onSend, onStop }: {
  input: string; setInput: (text: string) => void; running: boolean; loading: boolean;
  historyFailed: boolean; error?: string; reload: () => void; onSend: () => void; onStop: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(sizing.touchTarget);
  return (
    <View style={styles.composerWrap}>
      {historyFailed && (
        <Pressable accessibilityRole="button" onPress={reload} disabled={loading}>
          <Text style={{ ...typography.muted, color: colors.accent }}>重新加载会话</Text>
        </Pressable>
      )}
      {error ? (
        <Text style={{ ...typography.small, color: colors.danger, marginBottom: spacing[6] }}>
          {error}
        </Text>
      ) : null}
      <View
        style={[
          styles.composer,
          focused ? styles.composerFocused : null,
          focused ? shadows.composerFocused : shadows.composer,
        ]}
      >
        <TextInput
          accessibilityLabel="消息输入框"
          value={input}
          onChangeText={setInput}
          multiline
          editable={!loading && !historyFailed}
          onKeyPress={Platform.OS === 'web' ? (event) => {
            // RN Web 的原生事件保留键盘修饰键；输入法合成中的 Enter 不能误发送。
            const key = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
            if (key.key === 'Enter' && !key.shiftKey && !key.isComposing && key.keyCode !== 229) {
              event.preventDefault();
              onSend();
            }
          } : undefined}
          placeholder="和 Pagent 说说…"
          placeholderTextColor={colors.muted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onContentSizeChange={(e) =>
            setInputHeight(
              Math.max(sizing.touchTarget, Math.min(sizing[140], e.nativeEvent.contentSize.height)),
            )
          }
          style={[styles.input, { height: input ? inputHeight : sizing.touchTarget }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as unknown as TextStyle)]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={running ? '停止' : '发送'}
          disabled={!running && (loading || historyFailed || !input.trim())}
          onPress={() => (running ? onStop() : onSend())}
          style={({ pressed }) => [
            styles.sendButton,
            !running && !input.trim() && { opacity: 0.5 },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          {running ? (
            <Square size={sizing[15]} color={colors.ink} fill={colors.ink} />
          ) : (
            <ArrowUp size={sizing[19]} strokeWidth={2} color={colors.ink} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerWrap: { paddingHorizontal: spacing.xxs, paddingBottom: spacing[6] },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: sizing.borderWidth,
    borderColor: colors.inputBorder,
    paddingLeft: spacing[16],
    paddingRight: spacing[6],
    paddingVertical: spacing[5],
  },
  composerFocused: { borderColor: colors.inputFocusBorder },
  input: {
    flex: 1,
    ...typography.chat,
    color: colors.ink,
    paddingTop: spacing[10],
    paddingBottom: spacing[10],
    maxHeight: sizing[140],
    textAlignVertical: 'center',
  },
  sendButton: {
    width: sizing.touchTarget,
    height: sizing.touchTarget,
    borderRadius: radius[22],
    backgroundColor: colors.bubbleUser,
    alignItems: 'center',
    justifyContent: 'center',
  },

});
