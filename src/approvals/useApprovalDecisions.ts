import { useState } from 'react';
import type { ApprovalNotification } from '../api/types';
import { mergeApprovalDecisions, rememberDecision } from './decisions';

/** 由已登录的 Shell 持有，关闭弹层不丢失，退出登录即销毁。 */
export function useApprovalDecisions(pending: ApprovalNotification[] = []) {
  const [recent, setRecent] = useState<ApprovalNotification[]>([]);
  return {
    notifications: mergeApprovalDecisions(pending, recent),
    recordDecision: (decision: ApprovalNotification) => setRecent((previous) => rememberDecision(previous, decision)),
  };
}
