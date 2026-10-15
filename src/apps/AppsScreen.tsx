/**
 * 应用页：身份卡（名字/语气）+ 记忆卡（增改忘）+ SOUL/USER 人设编辑。
 *
 * 数据契约：身份来自快照 identity，保存走 POST /api/agent/identity；
 * 记忆来自快照 memories，三端点增/改/忘；SOUL/USER 走 GET|PUT /api/profile
 * （独立于快照，挂载时单独拉取）。
 */

import { Bot, Brain, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '../lib/api-context';
import { timeAgo } from '../lib/format';
import type { MemoryItem, WorkspaceSnapshot } from '../lib/types';
import {
  Button,
  Card,
  Empty,
  ErrorNotice,
  Field,
  IconBox,
  SectionHeading,
} from '../ui/components';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

/** 身份语气三选一（服务端枚举 warm/concise/thoughtful） */
const TONES: { value: string; label: string }[] = [
  { value: 'warm', label: '温和' },
  { value: 'concise', label: '简洁' },
  { value: 'thoughtful', label: '周到' },
];

export function AppsScreen({
  snapshot,
  refresh,
}: {
  snapshot: WorkspaceSnapshot | undefined;
  refresh: () => void;
}) {
  const memories = snapshot?.memories ?? [];
  const identity = snapshot?.identity;

  return (
    <View style={{ gap: spacing.xl }}>
      <IdentityCard identity={identity} refresh={refresh} />
      <MemoryCard memories={memories} refresh={refresh} />
      <ProfileCard />
    </View>
  );
}

// ---------------------------------------------------------------------------
// 身份卡
// ---------------------------------------------------------------------------

function IdentityCard({
  identity,
  refresh,
}: {
  identity: { name: string; tone: string } | undefined;
  refresh: () => void;
}) {
  const api = useApi();
  // 只为用户改过的字段保留草稿；未改字段直接读取快照，不用 effect 回填。
  // 因而首次快照和后续轮询都能同步，也不会用服务端旧值覆盖未保存输入。
  const [draft, setDraft] = useState<{ name?: string; tone?: string }>({});
  const name = draft.name ?? identity?.name ?? '';
  const tone = draft.tone ?? identity?.tone ?? 'warm';
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  return (
    <Card style={{ gap: spacing[14] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[11] }}>
        <IconBox icon={Bot} size={sizing[42]} tint={colors.avatarSky} iconColor={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>助手身份</Text>
          <Text style={{ ...typography.small, color: colors.muted }}>
            名字与语气会注入每一轮对话
          </Text>
        </View>
      </View>
      <ErrorNotice error={error} />
      <Field
        label="名字"
        value={name}
        editable={!busy}
        onChangeText={(value) => {
          if (saving.current) return;
          setDraft((previous) => ({ ...previous, name: value === identity?.name ? undefined : value }));
          setSaved(false);
        }}
        placeholder="助手的名字"
      />
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.small, fontWeight: '600', color: colors.ink }}>语气</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {TONES.map((item) => {
            const active = tone === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: busy }}
                disabled={busy}
                onPress={() => {
                  if (saving.current) return;
                  setDraft((previous) => ({ ...previous, tone: item.value === identity?.tone ? undefined : item.value }));
                  setSaved(false);
                }}
                style={[styles.toneChip, active && { backgroundColor: colors.tabActive }]}
              >
                <Text
                  style={{
                    ...typography.small,
                    fontWeight: '600',
                    color: active ? colors.ink : colors.muted,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Button
        primary
        busy={busy}
        onPress={async () => {
          if (saving.current) return;
          if (!name.trim()) {
            setError('名字不能为空');
            return;
          }
          saving.current = true;
          setBusy(true);
          setError(undefined);
          try {
            await api.saveIdentity({ name: name.trim(), tone });
            // 请求期间锁住编辑，成功后才清草稿；失败继续保留输入供重试。
            setDraft({});
            setSaved(true);
            refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            saving.current = false;
            setBusy(false);
          }
        }}
      >
        {saved ? '已保存 ✓' : '保存身份'}
      </Button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 记忆卡
// ---------------------------------------------------------------------------

function MemoryCard({ memories, refresh }: { memories: MemoryItem[]; refresh: () => void }) {
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeading title="记忆" action={adding ? undefined : '新增'} onPress={adding ? undefined : () => setAdding(true)} />
      <ErrorNotice error={error} />
      {adding && (
        <Card style={{ gap: spacing[10] }}>
          <Field label="要记住的事" value={draft} onChangeText={setDraft} placeholder="用一句话描述，如：我喜欢早起" />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
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
      )}
      {memories.length === 0 && !adding ? (
        <Empty icon={Brain} title="还没有记忆" detail="在聊天里说「记住…」，或点右上角新增。" />
      ) : (
        memories.map((memory) =>
          editingId === memory.id ? (
            <Card key={memory.id} style={{ gap: spacing[10] }}>
              <TextInput
                accessibilityLabel="编辑记忆"
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                style={styles.inlineInput}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
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
            <Card key={memory.id} style={{ gap: spacing.sm }}>
              <Text style={{ ...typography.text, color: colors.ink }}>{memory.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ ...typography.small, color: colors.muted }}>
                  {memory.source} · {timeAgo(memory.updatedAt)}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[6] }}>
                  <Button
                    small
                    icon={Pencil}
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
                    busy={busy}
                    onPress={() => void act(() => api.forgetMemory(memory.id))}
                  >
                    忘记
                  </Button>
                </View>
              </View>
            </Card>
          ),
        )
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SOUL / USER 人设折叠编辑
// ---------------------------------------------------------------------------

function ProfileCard() {
  const api = useApi();
  const [profile, setProfile] = useState<{ soul: string; user: string }>();
  const [open, setOpen] = useState<'soul' | 'user' | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const saving = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    api
      .getProfile()
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const save = async () => {
    // PUT 同时写入 SOUL/USER，必须先成功取得完整文本，不能用空串补另一段。
    // ref 同步封锁连点窗口，busy/loading 同时负责禁用界面编辑与保存。
    if (!profile || loading || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await api.saveProfile(profile);
      setProfile(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const section = (key: 'soul' | 'user') => ({
    title: key === 'soul' ? 'SOUL · 助手人设' : 'USER · 用户画像',
    hint: key === 'soul' ? '助手是谁、怎么说话' : '你是谁、你的偏好与习惯',
  });

  return (
    <Card style={{ gap: spacing.md }}>
      <SectionHeading title="人设文本" />
      <ErrorNotice error={error} />
      {loading ? <Text style={{ ...typography.small, color: colors.muted }}>加载中…</Text> : null}
      {!profile && !loading ? (
        <Button onPress={() => {
          setError(undefined);
          setLoading(true);
          setAttempt((previous) => previous + 1);
        }}>重试加载人设</Button>
      ) : null}
      {(['soul', 'user'] as const).map((key) => {
        const info = section(key);
        const expanded = open === key;
        return (
          <View key={key} style={styles.profileBlock}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : key)}
              style={({ pressed }) => [
                styles.row,
                { gap: spacing.sm, paddingVertical: spacing.xs },
                pressed && { opacity: 0.7 },
              ]}
            >
              {expanded ? (
                <ChevronDown size={sizing[15]} color={colors.muted} />
              ) : (
                <ChevronRight size={sizing[15]} color={colors.muted} />
              )}
              <Text style={{ ...typography.text, fontWeight: '600', color: colors.ink }}>
                {info.title}
              </Text>
            </Pressable>
            {expanded && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ ...typography.small, color: colors.muted }}>{info.hint}</Text>
                <TextInput
                  accessibilityLabel={info.title}
                  value={profile?.[key] ?? ''}
                  editable={!!profile && !loading && !busy}
                  onChangeText={(text) => {
                    if (loading || saving.current) return;
                    setProfile((previous) => previous ? { ...previous, [key]: text } : previous);
                  }}
                  multiline
                  placeholder="留空即清除该段人设"
                  placeholderTextColor={colors.muted}
                  style={styles.profileInput}
                />
              </View>
            )}
          </View>
        );
      })}
      <Button primary busy={busy} disabled={!profile || loading} onPress={() => void save()}>
        保存人设
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  toneChip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
  },
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
  profileBlock: { gap: spacing.sm },
  profileInput: {
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    borderRadius: radius.field,
    padding: spacing.md,
    minHeight: sizing[120],
    textAlignVertical: 'top',
    backgroundColor: colors.canvas,
    color: colors.ink,
    fontFamily: 'monospace' as const,
    fontSize: typography.small.fontSize,
  },
});
