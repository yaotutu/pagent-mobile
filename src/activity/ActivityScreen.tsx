/**
 * 任务页：后台+定时任务混合列表（状态徽章/控制/详情）与网页监控区块。
 *
 * 数据契约（对齐 openapi）：
 * - 快照 tasks 混合 kind=job（定时）|task（后台），按 updatedAt 倒序；
 * - 控制请求必须显式发送与任务 kind 一致的 target；后台任务不提供暂停/恢复；
 * - 监控创建走聊天 monitor 工具（技术定稿），页面只放引导与控制。
 *
 * 职责边界：本文件只做编排——列表渲染交给 TaskCard/MonitorCard，弹层交给
 * CreateTaskSheet/TaskDetailSheet；操作锁（busyId）、错误提示与快照刷新集中在此，
 * 保证任务与监控共用同一把操作锁语义。
 */

import { ListChecks } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useDemo } from '../demo/DemoProvider';
import { useApi } from '../api/ApiProvider';
import type { TaskAction } from '../api/contracts';
import type { AgentTask, WorkspaceSnapshot } from '../api/types';
import { Button } from '../ui/Buttons';
import { FilterPills } from '../ui/FilterPills';
import { Sheet } from '../ui/Sheet';
import { taskMatches } from './task-presentation';
import { Card } from '../ui/Surfaces';
import { Empty, ErrorNotice } from '../ui/Feedback';
import { SectionHeading } from '../ui/Rows';
import { colors, spacing, typography } from '../ui/tokens';
import { CreateTaskSheet } from './CreateTaskSheet';
import { MonitorCard } from './MonitorCard';
import { TaskCard } from './TaskCard';
import { TaskDetailSheet } from './TaskDetailSheet';

export function ActivityScreen({
  snapshot,
  refresh,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  refresh: () => void;
}) {
  const api = useApi();
  const demo = useDemo();
  const inFlight = useRef(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');
  const [showMonitors, setShowMonitors] = useState(false);
  const [monitorHelp, setMonitorHelp] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  const tasks = snapshot?.tasks ?? [];
  const monitors = snapshot?.monitors ?? [];

  const control = async (task: AgentTask, action: TaskAction) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(task.id);
    setError(undefined);
    try {
      // API 要求 target 必填且与快照 kind 同义，避免同一任务 ID 被错误分发到另一类控制器。
      await api.controlTask(task.id, action, task.kind);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusyId(undefined);
    }
  };

  const detail = detailId ? tasks.find((t) => t.id === detailId) : undefined;

  return (
    <View style={{ gap: spacing.xl }}>
      <FilterPills value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部' }, { value: 'active', label: '进行中' }, { value: 'finished', label: '已结束' }]} />
      <SectionHeading title="后台与定时任务" action="新建" onPress={() => setCreating(true)} />
      <ErrorNotice error={error} />
      {tasks.length === 0 ? (
        <Empty
          icon={ListChecks}
          title="还没有任务"
          detail="在聊天里让助手安排，或点右上角新建一个后台任务。"
        />
      ) : (
        tasks.filter((task) => taskMatches(task, filter)).map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={() => { setError(undefined); setDetailId(task.id); }}
          />
        ))
      )}

      {tasks.length > 0 && !tasks.some((task) => taskMatches(task, filter)) && <Text style={{ ...typography.muted, color: colors.muted }}>这个分类还没有任务。</Text>}
      <SectionHeading title="网页监控" action="添加监控" onPress={() => setMonitorHelp(true)} />
      {monitors.length === 0 ? (
        <Card style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.text, color: colors.ink }}>还没有监控</Text>
          <Text style={{ ...typography.muted, color: colors.muted }}>
            在聊天里对我说「帮我监控 example.com 的价格变化」，即可创建网页监控；命中后会主动通知你。
          </Text>
        </Card>
      ) : (
        (showMonitors ? monitors : monitors.slice(0, 3)).map((monitor) => (
          <MonitorCard
            key={monitor.id}
            monitor={monitor}
            onControl={async (action) => {
              if (inFlight.current) return;
              inFlight.current = true;
              setBusyId(monitor.id);
              setError(undefined);
              try {
                await api.controlMonitor(monitor.id, action);
                refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                inFlight.current = false;
      setBusyId(undefined);
              }
            }}
            busy={busyId === monitor.id}
          />
        ))
      )}

      {monitors.length > 3 && <Button onPress={() => setShowMonitors(!showMonitors)}>{showMonitors ? '收起监控' : `查看全部 ${monitors.length} 个监控`}</Button>}
      {monitorHelp && <Sheet title="添加网页监控" onClose={() => setMonitorHelp(false)}><Text style={{ ...typography.muted, color: colors.muted }}>在聊天中告诉助手网址、关注的变化和检查频率，例如「帮我监控旅行页面的价格变化」。演示工作区也支持这条指令。</Text></Sheet>}
      {creating && (
        <CreateTaskSheet
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
      {detail && <TaskDetailSheet task={detail} onClose={() => setDetailId(undefined)} busy={busyId === detail.id} error={error} onAdvance={demo ? () => { demo.client.advanceTask(detail.id); refresh(); } : undefined} onControl={(action) => void control(detail, action)} />}
    </View>
  );
}
