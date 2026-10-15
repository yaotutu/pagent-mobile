/**
 * 审批 Sheet（顶栏铃铛入口）：pending 写操作的批准/拒绝 + 历史决定。
 *
 * 协议约束：
 * - 只有 pending 可决定，成功后本地保留返回状态，避免快照更新前重复决定；
 * - pending 5 分钟不决定自动 expired（轮询快照自然呈现）；
 * - payload 键名服务端文档未定义（docs/notes.md 待澄清），
 *   此处按 Record<string,string> 通用遍历渲染，不猜测语义。
 */

import { FileText } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApi } from '../lib/api-context';
import { timeAgo } from '../lib/format';
import type { ApprovalNotification } from '../lib/types';
import { Button, Empty, IconBox, Sheet, StatusBadge } from '../ui/components';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function ApprovalsSheet({
  notifications,
  onClose,
  refresh,
  onDecided,
}: {
  notifications: ApprovalNotification[];
  onClose: () => void;
  refresh: () => void;
  onDecided: (decision: ApprovalNotification) => void;
}) {
  const api = useApi();
  const [busyId, setBusyId] = useState<string>();
  const deciding = useRef(false);
  const decidedIds = useRef(new Set<string>());
  const [error, setError] = useState<string>();

  // Shell 合并当前 pending 与本次登录内已确认决定，关闭再打开也可查看最近操作。
  const pending = notifications.filter((n) => n.status === 'pending');
  const settled = notifications.filter((n) => n.status !== 'pending').slice(0, 10);

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    // state 禁用按钮要等渲染；同步锁额外阻止同一帧的连点和批准/拒绝交叉提交。
    if (deciding.current || decidedIds.current.has(id) || !pending.some((item) => item.id === id)) return;
    deciding.current = true;
    setBusyId(id);
    setError(undefined);
    try {
      const result = await api.decideAction(id, decision);
      decidedIds.current.add(id);
      onDecided(result);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      deciding.current = false;
      setBusyId(undefined);
    }
  };

  return (
    <Sheet
      title="审批"
      subtitle={pending.length ? `${pending.length} 项待处理` : '没有待处理事项'}
      onClose={onClose}
    >
      <View style={{ gap: spacing[14] }}>
        {error ? (
          <Text style={{ ...typography.small, color: colors.danger }}>{error}</Text>
        ) : null}
        {pending.length === 0 && settled.length === 0 ? (
          <Empty
            icon={FileText}
            title="没有审批事项"
            detail="助手请求写入或编辑文件时，会先在这里征求你的同意。"
          />
        ) : null}
        {pending.map((item) => (
          <ApprovalCard key={item.id} item={item} busy={busyId === item.id} disabled={busyId !== undefined} onDecide={decide} />
        ))}
        {settled.length > 0 && (
          <View style={{ gap: spacing[9] }}>
            <Text style={styles.sectionLabel}>最近决定</Text>
            {settled.map((item) => (
              <View key={item.id} style={[styles.row, { gap: spacing[10] }]}>
                <IconBox icon={FileText} size={sizing[28]} iconSize={sizing[14]} tint={colors.subtle} />
                <View style={{ flex: 1, gap: spacing[2] }}>
                  <Text style={{ ...typography.text, color: colors.ink }} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.decidedAt ? (
                    <Text style={{ ...typography.small, color: colors.muted }}>
                      {timeAgo(item.decidedAt)}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge status={item.status} />
              </View>
            ))}
          </View>
        )}
      </View>
    </Sheet>
  );
}

function ApprovalCard({
  item,
  busy,
  disabled,
  onDecide,
}: {
  item: ApprovalNotification;
  busy?: boolean;
  disabled?: boolean;
  onDecide: (id: string, decision: 'approve' | 'deny') => void;
}) {
  // 保留四行预览，但允许检查完整 payload 后再审批，避免截断关键写入内容。
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <View style={[styles.row, { gap: spacing[10] }]}>
        <IconBox icon={FileText} tint={colors.waiting} />
        <View style={{ flex: 1, gap: spacing[2] }}>
          <Text style={{ ...typography.text, fontWeight: '500', color: colors.ink }} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={{ ...typography.small, color: colors.muted }}>
            {item.kind === 'file_write' ? '写入' : '编辑'} · {timeAgo(item.createdAt)} · 5 分钟内有效
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>
      <View style={{ gap: spacing[6] }}>
        {Object.entries(item.payload).map(([key, value]) => (
          <View key={key} style={{ gap: spacing[2] }}>
            <Text style={styles.payloadKey}>{key}</Text>
            <Text style={styles.payloadValue} numberOfLines={expanded ? undefined : 4}>
              {value}
            </Text>
          </View>
        ))}
      </View>
      <Button small onPress={() => setExpanded((previous) => !previous)}>
        {expanded ? '收起内容' : '展开完整内容'}
      </Button>
      <View style={[styles.row, { justifyContent: 'flex-end', gap: spacing[8] }]}>
        <Button small danger busy={busy} disabled={disabled} onPress={() => onDecide(item.id, 'deny')}>
          拒绝
        </Button>
        <Button small primary busy={busy} disabled={disabled} onPress={() => onDecide(item.id, 'approve')}>
          批准
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing[16],
    gap: spacing[12],
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
  },
  sectionLabel: { ...typography.label, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  payloadKey: { ...typography.small, fontWeight: '600', color: colors.ink },
  payloadValue: {
    ...typography.small,
    fontFamily: 'monospace' as const,
    color: colors.muted,
    backgroundColor: colors.canvas,
    borderRadius: radius.notice,
    padding: spacing[8],
  },
});
