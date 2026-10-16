import { ArrowDown } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { colors, layout, radius, shadows, sizing, spacing, typography } from '../ui/tokens';
import { DemoScenarios } from '../demo/DemoScenarios';
import { ChatComposer } from './ChatComposer';
import { EmptyChat } from './EmptyChat';
import { MessageBubble } from './MessageBubble';
import type { ToolCardActions } from './tool-cards';
import { useConversation } from './useConversation';

export function ChatScreen({ threadId, onRunningChange, toolActions }: { threadId: string; onRunningChange: (running: boolean) => void; toolActions: ToolCardActions }) {
  const { views, running, error, loading, historyFailed, send: sendMessage, stop, reload } = useConversation(threadId);
  const [input, setInput] = useState('');
  const [stick, setStick] = useState(true);
  const stickRef = useRef(true);
  const draggingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  // 滚动与流式渲染可能交错，先同步意图，避免旧 effect 把用户拉回底部。
  const updateStick = (value: boolean) => {
    stickRef.current = value;
    setStick(value);
  };

  const beginScroll = () => {
    draggingRef.current = true;
    updateStick(false);
  };
  const finishScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    draggingRef.current = false;
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    updateStick(contentSize.height - layoutMeasurement.height - contentOffset.y < 100);
  };

  // Web 不发原生拖拽开始事件，滚轮也必须先中断贴底。
  const webScrollEvents = Platform.OS === 'web' ? { onWheel: () => updateStick(false) } : {};

  useEffect(() => { onRunningChange(running); }, [running, onRunningChange]);
  useEffect(() => () => onRunningChange(false), [onRunningChange]);
  useEffect(() => { if (stickRef.current) scrollRef.current?.scrollToEnd({ animated: false }); }, [views]);

  const send = (text: string) => sendMessage(text, () => {
    setInput('');
    updateStick(true);
  }, (failedText) => setInput((previous) => previous || failedText));

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        {...webScrollEvents}
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        // 原生内容布局晚于 effect，必须在实际高度更新后再贴底。
        onContentSizeChange={() => {
          if (stickRef.current) scrollRef.current?.scrollToEnd({ animated: false });
        }}
        onTouchMove={Platform.OS === 'web' ? () => updateStick(false) : undefined}
        onScrollBeginDrag={beginScroll}
        onScrollEndDrag={finishScroll}
        onMomentumScrollBegin={beginScroll}
        onMomentumScrollEnd={finishScroll}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distance =
            contentSize.height - layoutMeasurement.height - contentOffset.y;
          if (!draggingRef.current) updateStick(distance < 100);
        }}
        scrollEventThrottle={120}
      >
        {loading && <Text style={{ ...typography.muted, color: colors.muted }}>加载会话中…</Text>}
        {views.length === 0 && !running && !loading && !historyFailed ? (
          <EmptyChat onPick={(text) => void send(text)} />
        ) : (
          views.map((message) => <MessageBubble key={message.id} message={message} toolActions={toolActions} />)
        )}
      </ScrollView>

      {!stick && views.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="回到最新"
          onPress={() => {
            updateStick(true);
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
          style={[styles.backToLatest, shadows.composer]}
        >
          <ArrowDown size={sizing[16]} color={colors.ink} />
        </Pressable>
      )}

      <DemoScenarios onPick={(text) => void send(text)} disabled={running || loading || historyFailed} />
      <ChatComposer input={input} setInput={setInput} running={running} loading={loading}
        historyFailed={historyFailed} error={error} reload={reload}
        onSend={() => void send(input)} onStop={() => void stop()} />
    </View>
  );
}

const styles = StyleSheet.create({
  backToLatest: {
    position: 'absolute',
    bottom: layout.chatLatestBottom,
    alignSelf: 'center',
    width: sizing[36],
    height: sizing[36],
    borderRadius: radius[18],
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

});
