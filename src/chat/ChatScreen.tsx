/**
 * 聊天页：气泡流 + 工具卡 + 输入区（聊天主链路的 UI 侧）。
 *
 * 数据流协议（对齐服务端 AG-UI 契约）：
 * - 发送：乐观追加 user 消息 → runAgent 流式回调喂 StreamAggregator →
 *   每次事件后拷贝数组触发渲染；
 * - 结束：拉 GET /api/conversation 权威历史及版本整体替换（单一事实），
 *   拉取失败时保留聚合视图（settle 去掉 streaming 标记）；
 * - 停止：AbortController 中断本地消费 + POST stop 通知服务端；
 * - 智能滚动：距底 <100px 才跟随流式更新，脱离后显示"回到最新"。
 */

import { ArrowDown, ArrowUp, Square } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApi } from '../lib/api-context';
import { colors, layout, radius, shadows, sizing, spacing, typography } from '../ui/tokens';
import { StreamAggregator, projectHistory, type MessageView } from './chat-state';
import { ToolCard, type ToolCardActions } from './tool-cards';

/** 空态建议 prompt（点击直接发送，同时是 mock 模式的功能入口演示） */
const SUGGESTIONS = ['搜一下 pagent', '记住我喜欢早起', '把待办写入 notes.md'];

export function ChatScreen({ threadId, onRunningChange, toolActions }: { threadId: string; onRunningChange: (running: boolean) => void; toolActions: ToolCardActions }) {
  const api = useApi();
  const [views, setViews] = useState<MessageView[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>();
  const [stick, setStick] = useState(true);
  const [inputHeight, setInputHeight] = useState(44);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const revisionRef = useRef<string | null>(null);
  const aliveRef = useRef(false);

  // 父级以 threadId 为 key：卸载时取消旧流，且所有异步回写都检查生命周期。
  // 不保挂载多个会话，也不让旧请求污染新会话或已退出登录的界面。
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        if (runIdRef.current) void api.stopRun(threadId, runIdRef.current).catch(() => {});
      }
      onRunningChange(false);
    };
  }, [api, threadId, onRunningChange]);

  useEffect(() => { onRunningChange(running); }, [running, onRunningChange]);

  // 历史与版本未成功加载前禁止发送，避免以旧版本覆盖其他设备的新消息。
  useEffect(() => {
    let alive = true;
    api
      .getConversation(threadId)
      .then((history) => {
        if (alive) {
          revisionRef.current = history.revision;
          setViews(projectHistory(history.messages));
          setHistoryFailed(false);
          setError(undefined);
        }
      })
      .catch((e) => {
        if (alive) {
          setHistoryFailed(true);
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
  }, [api, threadId, historyVersion]);

  // 流式期间贴底跟随
  useEffect(() => {
    if (stick) scrollRef.current?.scrollToEnd({ animated: false });
  }, [views, stick]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading || historyFailed || abortRef.current || !revisionRef.current) return;
    setInput('');
    setInputHeight(44);
    setError(undefined);
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = `run-${Date.now()}`;
    runIdRef.current = runId;

    // 历史是服务端事实；客户端只发送新消息和读取历史时的版本，不再复制用户序列。
    const expectedRevision = revisionRef.current;
    const userView: MessageView = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      toolCalls: [],
    };
    const aggregator = new StreamAggregator([...views, userView]);
    setViews([...aggregator.messages]);
    setRunning(true);
    setStick(true);
    try {
      await api.runAgent(
        {
          threadId,
          runId,
          expectedRevision,
          message: { id: userView.id, content: text },
        },
        (event) => {
          if (!aliveRef.current || controller.signal.aborted) return;
          aggregator.push(event);
          if (event.type === 'RUN_ERROR') setError(event.message ?? '助手运行失败，请重试');
          setViews([...aggregator.messages]);
        },
        controller.signal,
      );
      try {
        const history = await api.getConversation(threadId);
        if (aliveRef.current) {
          revisionRef.current = history.revision;
          setViews(projectHistory(history.messages));
        }
      } catch {
        // 权威历史拉取失败：保留聚合视图（已验证的降级路径）
        aggregator.settle();
        if (aliveRef.current) {
          setViews([...aggregator.messages]);
          // 内容可以保留展示，但没有新版本不能安全发送下一轮。
          setHistoryFailed(true);
          setError('回复已结束，但会话同步失败，请重新加载后继续');
        }
      }
    } catch (e) {
      aggregator.settle();
      if (aliveRef.current) setViews([...aggregator.messages]);
      if (aliveRef.current && controller.signal.aborted) {
        // 停止也可能已落盘部分回复；恢复服务端历史与版本后才允许发送下一轮。
        try {
          const history = await api.getConversation(threadId);
          if (aliveRef.current) {
            revisionRef.current = history.revision;
            setViews(projectHistory(history.messages));
          }
        } catch {
          if (aliveRef.current) {
            setHistoryFailed(true);
            setError('停止后无法同步会话，请重新加载');
          }
        }
      } else if (aliveRef.current) {
        setError(e instanceof Error ? e.message : String(e));
        // 失败后保留待发送文本，但不覆盖用户在流式期间另写的新草稿。
        setInput((previous) => previous || text);
        // 请求可能已落盘，也可能因版本冲突被拒绝；先恢复权威历史再允许发送。
        setHistoryFailed(true);
      }
    } finally {
      if (aliveRef.current) setRunning(false);
      abortRef.current = null;
      runIdRef.current = null;
    }
  };

  const stop = async () => {
    const controller = abortRef.current;
    const runId = runIdRef.current;
    if (!controller || !runId) return;
    try {
      // 捕获本轮 controller：迟到的停止响应不能中断下一轮；false 也不能伪装停止成功。
      const stopped = await api.stopRun(threadId, runId);
      if (stopped && abortRef.current === controller) controller.abort();
    } catch (e) {
      if (aliveRef.current && abortRef.current === controller) {
        setError(`停止失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.lg, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const distance =
            contentSize.height - layoutMeasurement.height - contentOffset.y;
          setStick(distance < 100);
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
            setStick(true);
            scrollRef.current?.scrollToEnd({ animated: true });
          }}
          style={[styles.backToLatest, shadows.composer]}
        >
          <ArrowDown size={sizing[16]} color={colors.ink} />
        </Pressable>
      )}

      <View style={styles.composerWrap}>
        {historyFailed && (
          <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setHistoryVersion((value) => value + 1); }} disabled={loading}>
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
                void send(input);
              }
            } : undefined}
            placeholder="和 Pagent 说说…"
            placeholderTextColor={colors.muted}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onContentSizeChange={(e) =>
              setInputHeight(
                Math.max(44, Math.min(140, e.nativeEvent.contentSize.height)),
              )
            }
            style={[styles.input, { height: inputHeight }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={running ? '停止' : '发送'}
            disabled={!running && (loading || historyFailed || !input.trim())}
            onPress={() => (running ? void stop() : void send(input))}
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// 子组件
// ---------------------------------------------------------------------------

/** 单条消息：用户右对齐浅蓝气泡；助手为"文本气泡 + 工具卡"的纵向组合 */
function MessageBubble({ message, toolActions }: { message: MessageView; toolActions: ToolCardActions }) {
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
        Animated.timing(opacity, { toValue: 0.75, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
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

/** 空态：大标题 + 建议 prompt */
function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
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
  screen: { flex: 1 },
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

  backToLatest: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    width: sizing[36],
    height: sizing[36],
    borderRadius: radius[18],
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    paddingTop: spacing[11],
    paddingBottom: spacing[11],
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

  suggestion: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing[9],
  },
});
