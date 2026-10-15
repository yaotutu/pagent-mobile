/**
 * App 骨架：登录门 + 4 tab 状态机 + 顶栏 + 底部 pill tab bar + Sheet 层。
 *
 * 职责边界：
 * - 无导航库（技术定稿）：View 状态机切换四个页面，详情/弹层走 Sheet。
 * - 布局对照 OpenMuse App.tsx 的 WorkspaceShell 模式（顶栏三段式、
 *   内容区居中窄栏、底部悬浮胶囊 tab bar），视觉常量全部取自 tokens。
 * - 登录与快照由 App 注入真实 HTTP 数据；本组件仅负责界面状态。
 */

import {
  Bell,
  Bot,
  Check,
  Menu,
  MessageCircle,
  PanelsTopLeft,
  Plus,
  type LucideIcon,
  Shapes,
  SquareCheck,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityScreen } from './activity/ActivityScreen';
import { ApprovalsSheet } from './activity/ApprovalsSheet';
import { AppsScreen } from './apps/AppsScreen';
import { ChatScreen } from './chat/ChatScreen';
import { GoalsScreen } from './goals/GoalsScreen';
import type { ApprovalNotification, WorkspaceSnapshot } from './lib/types';
import { Button, Card, ErrorNotice, Field, IconButton, IconBox, Sheet } from './ui/components';
import { colors, layout, radius, shadows, sizing, spacing, typography } from './ui/tokens';

/** 四个主 tab（技术定稿：状态机切换，不引导航库）。HANDOFF 原文称 View，因与 RN View 重名改为 TabView。 */
export type TabView = 'chat' | 'activity' | 'goals' | 'apps';

const NAV: { id: TabView; label: string; icon: LucideIcon }[] = [
  { id: 'chat', label: '聊天', icon: MessageCircle },
  { id: 'activity', label: '任务', icon: PanelsTopLeft },
  { id: 'goals', label: '目标', icon: SquareCheck },
  { id: 'apps', label: '应用', icon: Shapes },
];

/** 非 chat 页的标题与副标题（chat 页顶栏直接展示 agent 名） */
const PAGE_TITLES: Record<Exclude<TabView, 'chat'>, { title: string; subtitle: string }> = {
  activity: { title: '任务', subtitle: '定时任务、后台任务与网页监控。' },
  goals: { title: '目标', subtitle: '长期目标、里程碑与进度。' },
  apps: { title: '应用', subtitle: '助手身份、记忆与人设。' },
};

/**
 * 登录门只采集访问密钥；鉴权、凭证持久化与错误处理由 App 负责。
 */
export function LoginGate({ onLogin, busy, error }: { onLogin: (accessKey?: string) => void; busy?: boolean; error?: string }) {
  const [accessKey, setAccessKey] = useState('');
  return (
    <SafeAreaView style={styles.loginCanvas}>
      <View style={styles.loginColumn}>
        <IconBox icon={Bot} size={sizing[64]} iconSize={sizing[30]} tint={colors.avatarSky} iconColor={colors.accent} />
        <Text style={styles.loginTitle}>Pagent</Text>
        <Text style={{ ...typography.muted, color: colors.muted, textAlign: 'center' }}>
          你的个人助理工作台
        </Text>
        <Card style={{ width: layout.fullWidth }}>
          <ErrorNotice error={error} />
          <Field
            label="访问密钥（可选）"
            value={accessKey}
            onChangeText={setAccessKey}
            secureTextEntry
            placeholder="回环部署无需密钥"
          />
          <Button primary busy={busy} onPress={() => onLogin(accessKey || undefined)}>
            进入工作台
          </Button>
          <Text style={{ ...typography.small, color: colors.muted, marginTop: spacing[15] }}>
            默认连接本机服务；无密钥部署可直接进入。
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

/** 会话条目形状（接口阶段对齐 GET /api/threads 的 {id, updatedAt}） */
export type ThreadInfo = { id: string; updatedAt: string };

/**
 * 主界面骨架：顶栏（汉堡 / agent 名+状态 / 铃铛）+ 当前 tab 页 + 底部 tab bar。
 * 顶栏数据（agent 名/状态行/审批未读）与工作台三页共用快照轮询结果。
 */
export function AppShell({
  snapshot,
  snapshotError,
  refresh,
  threads,
  currentThread,
  onSelectThread,
  onCreateThread,
}: {
  /** /api/agent 快照（App 层轮询下发）；未就绪时顶栏回落默认文案 */
  snapshot: WorkspaceSnapshot | undefined;
  snapshotError?: string;
  /** 操作后立即刷新快照（不等下一个轮询周期） */
  refresh: () => void;
  threads: ThreadInfo[];
  currentThread: string;
  onSelectThread: (id: string) => void;
  onCreateThread: () => void;
}) {
  const [view, setView] = useState<TabView>('chat');
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  // pending 接口不提供历史；只保存本次登录里由用户实际提交并获服务端确认的最近决定。
  const [recentApprovals, setRecentApprovals] = useState<ApprovalNotification[]>([]);
  const [chatRunning, setChatRunning] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = width >= layout.desktopBreakpoint;

  const pendingApprovals = snapshot?.notifications ?? [];
  const notifications = [
    ...pendingApprovals.map((item) => item.status === 'pending'
      ? recentApprovals.find((decision) => decision.id === item.id) ?? item : item),
    ...recentApprovals.filter((decision) => !pendingApprovals.some((item) => item.id === decision.id)),
  ];
  const pendingCount = notifications.filter((n) => n.status === 'pending').length;
  const runningTask = snapshot?.tasks.find((t) => t.status === 'running');
  const agentName = snapshot?.identity.name ?? 'Pagent';
  const statusText = pendingCount > 0
    ? `${pendingCount} 项待审批`
    : runningTask
      ? `任务进行中 · ${runningTask.title}`
      : chatRunning ? '思考中…' : snapshot ? '就绪' : '连接中…';

  return (
    <SafeAreaView style={styles.shell} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.column} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} enabled={Platform.OS !== 'web'}>
        {/* 顶栏：左汉堡（会话 Sheet）/ 中 agent 名+状态 / 右铃铛（未读点） */}
        <View style={[styles.topBar, { height: desktop ? 96 : 76, paddingTop: desktop ? 14 : 2 }]}>
          <View style={styles.topBarLeft}>
            <IconButton icon={Menu} label="打开会话列表" onPress={() => setThreadsOpen(true)} />
          </View>
          <View style={styles.topBarCenter}>
            <Text style={styles.agentName} numberOfLines={1}>
              {agentName}
            </Text>
            <Text style={{ ...typography.small, color: colors.muted }} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <View style={styles.topBarRight}>
            <IconButton
              icon={Bell}
              label={`通知，${pendingCount} 项待处理`}
              onPress={() => setApprovalsOpen(true)}
            />
            {pendingCount > 0 && <View style={styles.unreadDot} pointerEvents="none" />}
          </View>
        </View>

        <ErrorNotice error={snapshotError ? `工作区刷新失败：${snapshotError}` : undefined} />
        {/* 单会话 chat 在 tab 间常驻；切换 thread 用 key 卸载，阻断旧流回写。 */}
        <View style={{ flex: 1, minHeight: 0 }}>
          {view !== 'chat' && (
            <ScrollView
              key={view}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: desktop ? 42 : 22,
                paddingBottom: spacing[28],
              }}
            >
              <Text style={{ ...typography.title, fontWeight: '600', color: colors.ink, marginBottom: spacing[6] }}>
                {PAGE_TITLES[view].title}
              </Text>
              <Text style={{ ...typography.muted, color: colors.muted, marginBottom: spacing.xl }}>
                {PAGE_TITLES[view].subtitle}
              </Text>
              {view === 'activity' && <ActivityScreen snapshot={snapshot} refresh={refresh} />}
              {view === 'goals' && <GoalsScreen snapshot={snapshot} refresh={refresh} />}
              {view === 'apps' && <AppsScreen snapshot={snapshot} refresh={refresh} />}
            </ScrollView>
          )}
          <View
            style={{
              display: view === 'chat' ? 'flex' : 'none',
              flex: 1,
              paddingHorizontal: desktop ? 42 : 17,
            }}
          >
            <ChatScreen key={currentThread} threadId={currentThread} onRunningChange={setChatRunning}
              toolActions={{ onNavigate: setView, onOpenApprovals: () => setApprovalsOpen(true) }} />
          </View>
        </View>

        {/* 底部悬浮 pill tab bar（OpenMuse 同款白胶囊软阴影） */}
        <View style={styles.tabBarWrap}>
          <View style={styles.tabBar}>
            {NAV.map((item) => {
              const active = view === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => setView(item.id)}
                  style={({ pressed }) => [
                    styles.tabItem,
                    active && { backgroundColor: colors.tabActive },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <item.icon size={sizing[23]} strokeWidth={1.8} color={colors.ink} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Sheet 层：会话列表 + 审批队列 */}
      {approvalsOpen && (
        <ApprovalsSheet
          notifications={notifications}
          onDecided={(decision) => setRecentApprovals((previous) =>
            [decision, ...previous.filter((item) => item.id !== decision.id)].slice(0, 10))}
          onClose={() => setApprovalsOpen(false)}
          refresh={refresh}
        />
      )}
      {threadsOpen && (
        <Sheet title="会话" subtitle={`${threads.length} 个会话`} onClose={() => setThreadsOpen(false)}>
          <View style={{ gap: spacing.xs }}>
            {threads.map((thread) => {
              const current = thread.id === currentThread;
              return (
                <Pressable
                  key={thread.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  onPress={() => {
                    onSelectThread(thread.id);
                    setView('chat');
                    setThreadsOpen(false);
                  }}
                  style={({ pressed }) => [styles.threadRow, pressed && { backgroundColor: colors.canvas }]}
                >
                  <MessageCircle size={sizing[18]} color={current ? colors.accent : colors.muted} />
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Text style={{ ...typography.text, color: colors.ink }} numberOfLines={1}>
                      {thread.id === 'local-main' ? '主会话' : thread.id}
                    </Text>
                    <Text style={{ ...typography.small, color: colors.muted }}>
                      {new Date(thread.updatedAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  {current && <Check size={sizing[16]} color={colors.accent} />}
                </Pressable>
              );
            })}
            <Button primary icon={Plus} onPress={() => { onCreateThread(); setThreadsOpen(false); setView('chat'); }} style={{ marginTop: spacing.md }}>
              新建会话
            </Button>
          </View>
        </Sheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginCanvas: {
    flex: 1,
    backgroundColor: colors.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.section,
  },
  loginColumn: {
    width: layout.fullWidth,
    maxWidth: layout.loginMaxWidth,
    gap: spacing[14],
    alignItems: 'center',
  },
  loginTitle: { ...typography.display, fontWeight: '500', color: colors.ink },

  shell: { flex: 1, backgroundColor: colors.canvas },
  column: { flex: 1, width: layout.fullWidth, maxWidth: layout.contentMaxWidth, alignSelf: 'center' },

  topBar: {
    marginHorizontal: spacing[20],
    justifyContent: 'center',
  },
  topBarLeft: { position: 'absolute', top: 8, left: 0, zIndex: 1 },
  topBarRight: { position: 'absolute', top: 8, right: 0, zIndex: 1 },
  topBarCenter: { alignItems: 'center', gap: spacing[1] },
  agentName: { ...typography.heading, fontWeight: '600', color: colors.ink, maxWidth: layout.topBarTitleWidth },
  unreadDot: {
    width: sizing[6],
    height: sizing[6],
    borderRadius: radius[4],
    position: 'absolute',
    top: 7,
    right: 9,
    backgroundColor: colors.accent,
  },

  tabBarWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing[10],
    paddingBottom: spacing[7],
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    width: layout.fullWidth,
    maxWidth: layout.tabBarMaxWidth,
    padding: spacing[5],
    backgroundColor: colors.card,
    borderRadius: radius.tab,
    ...shadows.tabBar,
    borderWidth: sizing.borderWidth,
    borderColor: colors.tabBarLine,
  },
  tabItem: {
    flex: 1,
    height: sizing[47],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.tabItem,
  },

  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing[11],
    paddingHorizontal: spacing[10],
    borderRadius: radius.notice,
  },
});
