/**
 * 业务状态徽章：把服务端状态枚举翻译成中文文案 + 语义色，交给 ui/Surfaces 的 Badge 渲染。
 *
 * 分层约定：枚举与文案属于业务层，ui/* 不感知任何业务状态；
 * ui 层只提供无业务的 Badge（label + bg + fg），因此新增服务端状态时
 * 只需在本文件登记，未登记的回落灰底显示原文，不会崩。
 */

import { Badge } from '../ui/Surfaces';
import { colors } from '../ui/tokens';

/** 服务端各端点 status 字段的枚举 → 展示语义。键为接口文档里的原始枚举值。 */
const STATUS_THEME: Record<string, { bg: string; fg: string; label: string }> = {
  // 任务（后台 task / 定时 job）
  queued: { bg: colors.waiting, fg: colors.ink, label: '排队中' },
  running: { bg: colors.sky, fg: colors.accent, label: '运行中' },
  scheduled: { bg: colors.sky, fg: colors.accent, label: '已排期' },
  paused: { bg: colors.subtle, fg: colors.muted, label: '已暂停' },
  succeeded: { bg: colors.successBg, fg: colors.success, label: '已完成' },
  failed: { bg: colors.dangerBg, fg: colors.danger, label: '失败' },
  cancelled: { bg: colors.subtle, fg: colors.muted, label: '已取消' },
  // 目标（active 与监控共用，视觉一致）
  active: { bg: colors.sky, fg: colors.accent, label: '进行中' },
  completed: { bg: colors.successBg, fg: colors.success, label: '已完成' },
  archived: { bg: colors.subtle, fg: colors.muted, label: '已归档' },
  // 监控
  stopped: { bg: colors.subtle, fg: colors.muted, label: '已停止' },
  // 审批通知
  pending: { bg: colors.waiting, fg: colors.ink, label: '待审批' },
  approved: { bg: colors.successBg, fg: colors.success, label: '已批准' },
  denied: { bg: colors.dangerBg, fg: colors.danger, label: '已拒绝' },
  expired: { bg: colors.subtle, fg: colors.muted, label: '已过期' },
};

export function StatusBadge({ status }: { status: string }) {
  const theme = STATUS_THEME[status] ?? { bg: colors.subtle, fg: colors.muted, label: status };
  return <Badge label={theme.label} bg={theme.bg} fg={theme.fg} />;
}
