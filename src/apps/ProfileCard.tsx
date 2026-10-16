// SOUL/USER 为整份 PUT 契约，单段编辑也必须保留另一段。

import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { SectionHeading } from '../ui/Rows';
import { Card } from '../ui/Surfaces';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

export function ProfileCard({ embedded }: { embedded?: boolean }) {
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

  const body = (
    <>
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
              aria-expanded={expanded}
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
    </>
  );

  if (embedded) {
    // Sheet 内直接铺内容，不再套一层白卡。
    return <View style={{ gap: spacing.md }}>{body}</View>;
  }
  return <Card style={{ gap: spacing.md }}>{body}</Card>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
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
