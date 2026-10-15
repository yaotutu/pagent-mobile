/**
 * 工具卡注册表：Map<toolName, ToolRenderer> + "*" 通配兜底（技术定稿）。
 *
 * - 渲染器读取 ToolCallView 与工作台跳转回调，自行容错解析 JSON：
 *   服务端 args 是 JSON 字符串、result 截断存储，任何解析失败都要能退化渲染；
 * - 新工具不注册也安全：通配卡展示原始参数与结果；
 * - 审批决定缺少 toolCallId 关联，工具卡只提供审批入口，不按路径猜测决定。
 */

import { FileText, Globe, Clock, CloudSun, CalendarClock, Activity, ListTodo, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconBox } from '../ui/components';
import { colors, layout, radius, sizing, spacing, typography } from '../ui/tokens';
import type { ToolCallView } from './chat-state';
import { z } from 'zod';
import { parseToolRecord, toolOutcome, toolTextField } from './tool-presentation';

/** 回调由 Shell 注入，工具卡不持有导航状态，也不会卸载正在运行的聊天。 */
export type ToolCardActions = {
  onNavigate: (target: 'activity' | 'apps') => void;
  onOpenApprovals: () => void;
};
export type ToolRenderer = (call: ToolCallView, actions: ToolCardActions) => ReactNode;

const registry = new Map<string, ToolRenderer>();

/** 注册专用工具卡（模块加载期调用一次；重复注册后者覆盖前者） */
export function registerToolCard(name: string, renderer: ToolRenderer) {
  registry.set(name, renderer);
}

/** 统一入口：查注册表，未命中走通配卡。 */
export function ToolCard({ call, actions }: { call: ToolCallView; actions: ToolCardActions }) {
  const renderer = registry.get(call.name) ?? registry.get('*')!;
  return <>{renderer(call, actions)}</>;
}

// ---------------------------------------------------------------------------
// 通用骨架与通配卡
// ---------------------------------------------------------------------------

/** 工具卡外框：灰底气泡形态，含图标 + 工具名标题区 */
function ToolFrame({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.frame}>
      <View style={[styles.row, { gap: spacing[8] }]}>
        <IconBox icon={Icon} size={sizing[26]} iconSize={sizing[14]} tint={colors.card} />
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {!!meta && (
          <Text style={{ ...typography.small, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

/** 参数/结果折叠行：默认收起 3 行，点按展开（长内容必需）；空值整体不渲染 */
function CollapsibleText({ text, lines = 3 }: { text?: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((previous) => !previous)}>
      <Text style={styles.mono} numberOfLines={open ? undefined : lines}>
        {text}
      </Text>
      <Text style={{ ...typography.small, color: colors.accent }}>{open ? '收起内容' : '展开内容'}</Text>
    </Pressable>
  );
}

/** 通配兜底卡：任何未注册工具都以"名称 + 参数 + 结果"原始呈现 */
function WildcardCard({ call }: { call: ToolCallView }) {
  return (
    <ToolFrame icon={Globe} title={call.name} meta={call.result !== undefined ? '执行已结束，请核对结果' : '调用中…'}>
      <CollapsibleText text={call.args} />
      <CollapsibleText text={call.result} />
    </ToolFrame>
  );
}

registerToolCard('*', (call) => <WildcardCard call={call} />);

// 工具结果是外部输入，不因 JSON 语法合法就信任结构；畸形/截断结果回退原文。
const searchResultSchema = z.object({
  results: z.array(z.object({ title: z.string().optional(), url: z.string().optional() })),
});

// ---------------------------------------------------------------------------
// 专用卡
// ---------------------------------------------------------------------------

/** search_web：来源链接列表（仅 http/https 可点，其余按纯文本渲染） */
registerToolCard('search_web', (call) => {
  const query = toolTextField(parseToolRecord(call.args), 'query');
  let results: { title?: string; url?: string }[] = [];
  try {
    const parsed = searchResultSchema.safeParse(JSON.parse(call.result ?? ''));
    results = parsed.success ? parsed.data.results : [];
  } catch {
    // result 可能被截断，退化走通配展示
  }
  return (
    <ToolFrame icon={Globe} title="网页搜索" meta={query}>
      {results.length > 0 ? (
        <View style={{ gap: spacing[9] }}>
          {results.map((item, index) => {
            const url = item.url ?? '';
            const safe = /^https?:\/\//.test(url);
            const row = (
              <View style={{ gap: spacing[1] }}>
                <Text style={{ ...typography.small, fontWeight: '600', color: colors.ink }} numberOfLines={1}>
                  {index + 1}. {item.title ?? url}
                </Text>
                <Text
                  style={{ ...typography.small, color: safe ? colors.accent : colors.muted }}
                  numberOfLines={1}
                >
                  {url}
                </Text>
              </View>
            );
            return safe ? (
              <Pressable key={url + index} onPress={() => void Linking.openURL(url).catch(() => {})}>
                {row}
              </Pressable>
            ) : (
              <View key={url + index}>{row}</View>
            );
          })}
        </View>
      ) : (
        <CollapsibleText text={call.result} />
      )}
    </ToolFrame>
  );
});

/** 轻量跳转入口只负责切换工作台，写操作的实际决定仍由审批 Sheet 提交。 */
function ToolAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
    <Text style={{ ...typography.muted, color: colors.accent }}>{label}</Text>
  </Pressable>;
}

/** write/edit 不以文件路径关联通知：同一路径可能有多次调用，猜测会显示错误决定。 */
for (const name of ['write', 'edit']) {
  registerToolCard(name, (call, actions) => {
    const path = toolTextField(parseToolRecord(call.args), 'path', 'file');
    const done = call.result !== undefined;
    return (
      <ToolFrame icon={FileText} title={name === 'write' ? '写入文件' : '编辑文件'} meta={path || undefined}>
        <CollapsibleText text={call.args} lines={2} />
        <Text style={{ ...typography.small, color: colors.muted }}>
          {done ? '执行已结束，请核对结果；审批决定见审批列表' : '执行中；如需审批，请打开审批列表'}
        </Text>
        <CollapsibleText text={call.result} />
        <ToolAction label="查看审批" onPress={actions.onOpenApprovals} />
      </ToolFrame>
    );
  });
}

const outcomeLabels = { running: '处理中…', failed: '操作未成功，请核对结果', saved: '已保存', finished: '执行已结束，请核对结果' };

/** 记忆/任务操作可以是创建、查询或删除，不能统一宣称“保存成功”。 */
const workspaceTools = [
  { name: 'memory', title: '记忆', icon: FileText, target: 'apps' },
  { name: 'schedule', title: '定时任务', icon: CalendarClock, target: 'activity' },
  { name: 'monitor', title: '网页监控', icon: Activity, target: 'activity' },
  { name: 'delegate_task', title: '后台任务', icon: ListTodo, target: 'activity' },
] as const;
workspaceTools.forEach(({ name, title, icon, target }) => {
  registerToolCard(name, (call, actions) => (
    <ToolFrame icon={icon} title={title} meta={outcomeLabels[toolOutcome(call.result)]}>
      <CollapsibleText text={call.args} lines={2} />
      <CollapsibleText text={call.result} />
      <ToolAction label={target === 'apps' ? '查看记忆' : '查看任务与监控'} onPress={() => actions.onNavigate(target)} />
    </ToolFrame>
  ));
});

/** 天气当前只有文本契约：专用展示保留来源、观测时间和错误，结构化字段待服务端补充。 */
registerToolCard('get_weather', (call) => (
  <ToolFrame icon={CloudSun} title="天气" meta={toolTextField(parseToolRecord(call.args), 'city') || '默认城市'}>
    {call.result === undefined
      ? <Text style={styles.title}>正在查询天气…</Text>
      : <CollapsibleText text={call.result} lines={8} />}
  </ToolFrame>
));

/** 文件/网页结果可能很长且包含不可信内容；只按文本预览，不执行、不作为 URL 打开。 */
const previewTools = [
  ['read', '读取文件'], ['grep', '搜索文件内容'], ['find', '查找文件'],
  ['ls', '目录列表'], ['web_fetch', '网页预览'],
] as const;
previewTools.forEach(([name, title]) => registerToolCard(name, (call) => (
  <ToolFrame icon={name === 'web_fetch' ? Globe : FileText} title={title}
    meta={toolTextField(parseToolRecord(call.args), 'path', 'url', 'pattern')}>
    <CollapsibleText text={call.args} lines={2} />
    {call.result === undefined
      ? <Text style={styles.title}>加载中…</Text>
      : <CollapsibleText text={call.result} />}
  </ToolFrame>
)));

/** currentTime：单行轻量卡 */
registerToolCard('currentTime', () => (
  <View style={[styles.frame, styles.row]}>
    <IconBox icon={Clock} size={sizing[26]} iconSize={sizing[14]} tint={colors.card} />
    <Text style={{ ...typography.small, color: colors.muted }}>查询当前时间</Text>
  </View>
));

const styles = StyleSheet.create({
  action: { paddingVertical: spacing[8] },
  frame: {
    backgroundColor: colors.bubbleAssistant,
    borderRadius: radius.bubble,
    padding: spacing[13],
    gap: spacing[9],
    alignSelf: 'flex-start',
    maxWidth: layout.fullWidth,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { ...typography.small, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  mono: {
    ...typography.small,
    fontFamily: 'monospace' as const,
    color: colors.muted,
    backgroundColor: colors.card,
    borderRadius: radius.notice,
    padding: spacing[8],
  },
});
