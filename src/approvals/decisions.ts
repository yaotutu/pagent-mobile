import type { ApprovalNotification } from '../api/types';

/** 只用服务端确认的决定覆盖旧 pending 快照，不推测具体工具调用的审批结果。 */
export function mergeApprovalDecisions(
  pending: ApprovalNotification[],
  recent: ApprovalNotification[],
): ApprovalNotification[] {
  return [
    ...pending.map((item) => item.status === 'pending'
      ? recent.find((decision) => decision.id === item.id) ?? item : item),
    ...recent.filter((decision) => !pending.some((item) => item.id === decision.id)),
  ];
}

export function rememberDecision(previous: ApprovalNotification[], decision: ApprovalNotification) {
  return [decision, ...previous.filter((item) => item.id !== decision.id)].slice(0, 10);
}
