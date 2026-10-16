import type { TaskAction } from '../api/contracts';
import type { AgentTask } from '../api/types';

export function taskActions(task: AgentTask): { action: TaskAction; label: string; danger?: boolean }[] {
  if (task.kind === 'task') {
    if (task.status === 'failed') return [{ action: 'retry', label: '重试' }];
    return ['running', 'queued'].includes(task.status) ? [{ action: 'cancel', label: '取消任务', danger: true }] : [];
  }
  if (task.status === 'paused') return [{ action: 'resume', label: '恢复' }, { action: 'cancel', label: '停止定时任务', danger: true }];
  if (task.status === 'scheduled') return [{ action: 'pause', label: '暂停' }, { action: 'cancel', label: '停止定时任务', danger: true }];
  if (task.status === 'running') return [{ action: 'pause', label: '暂停' }, { action: 'cancel', label: '取消本次运行', danger: true }];
  return task.status === 'queued' ? [{ action: 'cancel', label: '取消任务', danger: true }] : [];
}

export function taskMatches(task: AgentTask, filter: 'all' | 'active' | 'finished') {
  const finished = ['succeeded', 'failed', 'cancelled'].includes(task.status);
  return filter === 'all' || (filter === 'finished' ? finished : !finished);
}
