import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { colors, layout, radius, sizing, spacing, typography } from '../ui/tokens';
import type { MessageView } from './chat-state';
import { ToolCard, type ToolCardActions } from './tool-cards';

/** 单条消息：用户右对齐浅蓝气泡；助手为"文本气泡 + 工具卡"的纵向组合 */
export function MessageBubble({ message, toolActions }: { message: MessageView; toolActions: ToolCardActions }) {
  if (message.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <Text style={{ ...typography.chat, color: colors.ink }}>{message.text}</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.assistantRow}>
      {message.text ? (
        <View style={styles.assistantBubble}>
          <Markdown style={markdownStyles} onLinkPress={allowLink}>
            {message.text}
          </Markdown>
        </View>
      ) : message.streaming && message.toolCalls.length === 0 ? (
        <TypingDots />
      ) : null}
      {message.toolCalls.map((call) => (
        <ToolCard key={call.id} call={call} actions={toolActions} />
      ))}
    </View>
  );
}

/** 流式三点指示：28 高灰胶囊内三点呼吸（无正文时的等待态） */
function TypingDots() {
  const [opacity] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.4, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.typingPill}>
      {[0, 1, 2].map((i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity }]} />
      ))}
    </View>
  );
}

/**
 * markdown 链接白名单：只放行 http/https（返回 true 走默认开链），
 * 其余协议一律拦截，杜绝 javascript: 等注入面。
 */
function allowLink(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

const markdownStyles = {
  body: { ...typography.chat, color: colors.ink },
  link: { color: colors.accent },
  strong: { fontWeight: '700' as const },
  code_inline: {
    backgroundColor: colors.codeBg,
    fontFamily: 'monospace' as const,
    fontSize: typography.small.fontSize,
  },
  fence: {
    backgroundColor: colors.codeBg,
    borderRadius: radius.notice,
    fontFamily: 'monospace' as const,
    fontSize: typography.small.fontSize,
    color: colors.ink,
  },
};

const styles = StyleSheet.create({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble: {
    backgroundColor: colors.bubbleUser,
    borderRadius: radius.bubble,
    borderBottomRightRadius: radius.bubbleTail,
    paddingHorizontal: spacing[15],
    paddingVertical: spacing[11],
    maxWidth: layout.userBubbleMaxWidth,
  },
  assistantRow: { gap: spacing.sm, maxWidth: layout.assistantRowWidth, width: layout.assistantRowWidth },
  assistantBubble: {
    backgroundColor: colors.bubbleAssistant,
    borderRadius: radius.bubble,
    borderBottomLeftRadius: radius.bubbleTail,
    paddingHorizontal: spacing[15],
    paddingVertical: spacing[11],
    alignSelf: 'flex-start',
    maxWidth: layout.fullWidth,
  },
  typingPill: {
    flexDirection: 'row',
    gap: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
    height: sizing[28],
    width: sizing[58],
    borderRadius: radius.bubble,
    backgroundColor: colors.bubbleAssistant,
  },
  typingDot: { width: sizing[6], height: sizing[6], borderRadius: radius[3], backgroundColor: colors.ink },

});
