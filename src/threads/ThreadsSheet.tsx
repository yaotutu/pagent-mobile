import { Archive, Check, ChevronRight, FlaskConical, ListChecks, MessageCircle, Pencil, Plus, RefreshCw, Server, Shapes, SquareCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThreadInfo } from '../api/types';
import { useServiceConnection } from '../connection/ConnectionProvider';
import { useDemo } from '../demo/DemoProvider';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

type Destination = 'chat' | 'activity' | 'goals' | 'apps';
export function ThreadsSheet({ threads, currentThread, onSelectThread, onCreateThread, onClose, error, onRetry, onNavigate, refresh, onDemo }: {
  threads: ThreadInfo[]; currentThread: string; onSelectThread: (id: string) => void;
  onCreateThread: () => void; onClose: () => void; error?: string; onRetry: () => void;
  onNavigate: (destination: Destination) => void; refresh: () => void; onDemo: () => void;
}) {
  const demo = useDemo();
  const connection = useServiceConnection();
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [title, setTitle] = useState('');
  const [, update] = useState(0);
  const all = demo ? demo.client.listDemoThreads() : threads.map((thread) => ({ ...thread, title: thread.id, archived: false }));
  const sideThreads = all.filter((thread) => thread.id !== 'local-main' && thread.archived === archived);
  const select = (id: string) => { onSelectThread(id); onClose(); };
  return (
    <Sheet title="Pagent" subtitle="你的个人助理工作区" onClose={onClose}>
      <View style={{ gap: spacing.lg }}>
        <ErrorNotice error={error} />
        {error && <Button onPress={onRetry}>重新加载会话</Button>}
        <Pressable accessibilityRole="button" accessibilityLabel="打开主会话" onPress={() => select('local-main')} style={styles.threadRow}>
          <MessageCircle size={sizing[22]} color={colors.ink} />
          <View style={{ flex: 1 }}><Text style={styles.title}>主会话</Text><Text style={styles.hint}>与你的助手持续对话</Text></View>
          {currentThread === 'local-main' && <Check size={sizing[18]} color={colors.accent} />}
        </Pressable>
        <Button icon={Plus} onPress={() => { onCreateThread(); onClose(); }}>新建独立会话</Button>
        <View style={styles.heading}><Text style={styles.title}>独立会话</Text>{demo && <Button small onPress={() => setArchived(!archived)}>{archived ? '查看进行中' : '已归档'}</Button>}</View>
        {sideThreads.length === 0 && <Text style={styles.hint}>{archived ? '还没有已归档的会话。' : '给一个独立主题留个位置，主会话始终在这里。'}</Text>}
        {sideThreads.map((thread) => (
          <View key={thread.id} style={{ gap: spacing.xs }}>
            <Pressable accessibilityRole="button" onPress={() => select(thread.id)} style={styles.threadRow}>
              <MessageCircle size={sizing[18]} color={colors.muted} />
              <View style={{ flex: 1 }}><Text style={styles.title} numberOfLines={1}>{thread.title}</Text><Text style={styles.hint}>{new Date(thread.updatedAt).toLocaleDateString('zh-CN')}</Text></View>
              {currentThread === thread.id ? <Check size={sizing[18]} color={colors.accent} /> : <ChevronRight size={sizing[18]} color={colors.muted} />}
            </Pressable>
            {demo && <View style={styles.actions}>
              <Button small icon={Pencil} onPress={() => { setEditing(thread.id); setTitle(thread.title); }}>重命名</Button>
              <Button small icon={Archive} onPress={() => {
                demo.client.archiveThread(thread.id, !archived);
                if (currentThread === thread.id && !archived) onSelectThread('local-main');
                update((value) => value + 1);
              }}>{archived ? '恢复' : '归档'}</Button>
            </View>}
            {editing === thread.id && <View style={{ gap: spacing.xs }}>
              <Field label="会话名称" value={title} onChangeText={setTitle} />
              <View style={styles.actions}><Button small primary disabled={!title.trim()} onPress={() => { demo?.client.renameThread(thread.id, title); setEditing(undefined); }}>保存名称</Button><Button small onPress={() => setEditing(undefined)}>取消</Button></View>
            </View>}
          </View>
        ))}
        <Text style={styles.hint}>{demo ? '演示的名称和归档仅保存在本次工作区。' : '服务端暂未开放会话名称与归档接口，当前按会话 ID 展示。'}</Text>
        <Text style={styles.hint}>各会话保留独立上下文，助手的记忆在工作区内共享。</Text>
        <View style={styles.links}>
          {([
            { target: 'activity', label: '任务与监控', icon: ListChecks },
            { target: 'goals', label: '目标与里程碑', icon: SquareCheck },
            { target: 'apps', label: '助手偏好与记忆', icon: Shapes },
          ] as const).map(({ target, label, icon: Icon }) => <Pressable key={target} accessibilityRole="button" onPress={() => { onNavigate(target); onClose(); }} style={styles.threadRow}>
            <Icon size={sizing[20]} color={colors.ink} /><Text style={[styles.title, { flex: 1 }]}>{label}</Text><ChevronRight size={sizing[18]} color={colors.muted} />
          </Pressable>)}
          <Button icon={RefreshCw} onPress={() => { refresh(); onRetry(); }}>刷新工作区</Button>
          {connection && <Button icon={Server} onPress={() => { onClose(); connection.changeServer(); }}>更改服务器</Button>}
          {!demo && <Button icon={FlaskConical} onPress={() => { onClose(); onDemo(); }}>体验独立演示工作区</Button>}
        </View>
      </View>
    </Sheet>
  );
}
const styles = StyleSheet.create({
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderRadius: radius.notice, minHeight: sizing.touchTarget },
  title: { ...typography.text, fontWeight: '600', color: colors.ink },
  hint: { ...typography.small, color: colors.muted },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  links: { borderTopWidth: sizing.borderWidth, borderTopColor: colors.line, paddingTop: spacing.md, gap: spacing.sm },
});
