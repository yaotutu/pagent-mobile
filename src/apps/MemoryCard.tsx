// 记忆写入成功后刷新权威快照，删除确认与列表共用同一个弹层。

import { Brain, Pencil, Plus, Search, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import type { MemoryItem } from '../api/types';
import { timeAgo } from '../shared/format';
import { Button } from '../ui/Buttons';
import { Empty, ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { SectionHeading } from '../ui/Rows';
import { Card } from '../ui/Surfaces';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function MemoryCard({
  memories,
  refresh,
  embedded,
}: {
  memories: MemoryItem[];
  refresh: () => void;
  /** 放进 Sheet 时置 true：去掉外层白卡标题，单条记忆改用分隔行。 */
  embedded?: boolean;
}) {
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState('');
  const [confirmForget, setConfirmForget] = useState<MemoryItem>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // 三条写操作（新增/编辑/忘记）共用同一套 busy + 错误处理，只在 act 里做差异。
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // 检索在前端做：记忆量小，避免为一个筛选再打服务端。
  const keyword = query.trim().toLowerCase();
  const visible = keyword
    ? memories.filter((memory) => `${memory.text} ${memory.source}`.toLowerCase().includes(keyword))
    : memories;

  const searchField = (
    <View style={styles.searchBox}>
      <Search size={sizing[15]} color={colors.muted} />
      <TextInput
        accessibilityLabel="检索记忆"
        value={query}
        onChangeText={setQuery}
        placeholder="检索记忆"
        placeholderTextColor={colors.muted}
        autoCorrect={false}
        style={styles.searchInput}
      />
    </View>
  );

  const addForm = adding && (
    <Card style={{ gap: spacing[10] }}>
      <Field label="要记住的事" value={draft} onChangeText={setDraft} placeholder="用一句话描述，如：我喜欢早起" />
      <View style={styles.actions}>
        <Button small onPress={() => { setAdding(false); setDraft(''); }}>
          取消
        </Button>
        <Button
          small
          primary
          icon={Plus}
          busy={busy}
          onPress={() =>
            void act(async () => {
              if (!draft.trim()) throw new Error('内容不能为空');
              await api.addMemory(draft.trim());
              setAdding(false);
              setDraft('');
            })
          }
        >
          保存
        </Button>
      </View>
    </Card>
  );

  const item = (memory: MemoryItem) =>
    editingId === memory.id ? (
      <Card key={memory.id} style={{ gap: spacing[10] }}>
        <TextInput
          accessibilityLabel="编辑记忆"
          value={editDraft}
          onChangeText={setEditDraft}
          multiline
          style={styles.inlineInput}
        />
        <View style={styles.actions}>
          <Button small onPress={() => setEditingId(undefined)}>
            取消
          </Button>
          <Button
            small
            primary
            busy={busy}
            onPress={() =>
              void act(async () => {
                if (!editDraft.trim()) throw new Error('内容不能为空');
                await api.editMemory(memory.id, editDraft.trim());
                setEditingId(undefined);
              })
            }
          >
            保存
          </Button>
        </View>
      </Card>
    ) : (
      <View
        key={memory.id}
        style={[styles.itemRow, embedded && styles.itemRowFlat, { borderBottomColor: colors.line }]}
      >
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ ...typography.text, color: colors.ink }}>{memory.text}</Text>
          <Text style={{ ...typography.small, color: colors.muted }}>
            {memory.source} · {timeAgo(memory.updatedAt)}
          </Text>
        </View>
        <View style={styles.actions}>
          <Button
            small
            icon={Pencil}
            disabled={busy}
            onPress={() => {
              setEditingId(memory.id);
              setEditDraft(memory.text);
            }}
          >
            编辑
          </Button>
          <Button
            small
            danger
            icon={Trash2}
            disabled={busy}
            onPress={() => setConfirmForget(memory)}
          >
            忘记
          </Button>
        </View>
      </View>
    );

  const list = memories.length === 0 ? (
    <Empty icon={Brain} title="还没有记忆" detail="在聊天里说「记住…」，或点右上角新增。" />
  ) : visible.length === 0 ? (
    // 无匹配：与"还没有记忆"区分开，明确是检索没命中。
    <Empty icon={Search} title="没有匹配的记忆" detail={`「${query.trim()}」没有命中，换个词试试。`}>
      <Button small onPress={() => setQuery('')}>清除检索</Button>
    </Empty>
  ) : (
    <View>{visible.map(item)}</View>
  );

  const body = (
    <>
      <SectionHeading
        title="记忆"
        action={adding ? undefined : '新增'}
        onPress={adding ? undefined : () => setAdding(true)}
      />
      <ErrorNotice error={error} />
      {searchField}
      {addForm}
      {list}
    </>
  );

  if (confirmForget) return (
    <View style={{ gap: spacing[14] }}>
      <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>忘记这条记忆？</Text>
      <Text style={{ ...typography.text, color: colors.ink }}>{confirmForget.text}</Text>
      <Text style={{ ...typography.muted, color: colors.muted }}>之后助手不会再把它当作你的偏好，记录无法恢复。</Text>
      <ErrorNotice error={error} />
      <View style={styles.actions}>
        <Button disabled={busy} onPress={() => setConfirmForget(undefined)}>取消</Button>
        <Button danger icon={Trash2} busy={busy} onPress={() => void act(async () => {
          await api.forgetMemory(confirmForget.id);
          setConfirmForget(undefined);
        })}>确认忘记</Button>
      </View>
    </View>
  );
  return <View style={{ gap: spacing.md }}>{body}</View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: sizing.inputMinHeight,
    borderRadius: radius.field,
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: typography.chat.fontSize, paddingVertical: spacing.md },
  itemRow: { gap: spacing.sm, paddingVertical: spacing.md },
  /** Sheet 内的记忆行不再套卡，去掉底部描边以免与分隔线重复 */
  itemRowFlat: { paddingHorizontal: 0 },
  inlineInput: {
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    borderRadius: radius.field,
    padding: spacing.md,
    minHeight: sizing[70],
    textAlignVertical: 'top',
    backgroundColor: colors.card,
    color: colors.ink,
    ...typography.text,
  },
});
