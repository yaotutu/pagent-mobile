// 未修改字段读取快照，草稿只保存用户输入，避免轮询覆盖编辑。

import { Bot } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import type { Identity } from '../api/types';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { CheckRow, SectionHeading } from '../ui/Rows';
import { Card, IconBox } from '../ui/Surfaces';
import { colors, radius, sizing, spacing, typography } from '../ui/tokens';

/** 身份语气三选一（服务端枚举 warm/concise/thoughtful） */
const TONES: { value: string; label: string }[] = [
  { value: 'warm', label: '温和' },
  { value: 'concise', label: '简洁' },
  { value: 'thoughtful', label: '周到' },
];

/**
 * 三色头像单选：不引图片资源与新依赖，就地复用 tokens.avatar* 三色底 + Bot 图标。
 * value 与 Identity.avatar 同名字符串对齐（sky/sand/lilac）。
 */
const AVATARS: { value: string; label: string; tint: string }[] = [
  { value: 'sky', label: '浅蓝', tint: colors.avatarSky },
  { value: 'sand', label: '浅沙', tint: colors.avatarSand },
  { value: 'lilac', label: '浅紫', tint: colors.avatarLilac },
];

export function IdentityCard({
  identity,
  refresh,
  embedded,
}: {
  identity: Identity | undefined;
  refresh: () => void;
  /** 放进 Sheet 时置 true：去掉外层白卡与卡内标题，只留表单本体。 */
  embedded?: boolean;
}) {
  const api = useApi();
  const [draft, setDraft] = useState<{
    name?: string;
    tone?: string;
    avatar?: string;
    showChatUpdates?: boolean;
  }>({});
  // 未改字段一律回落到快照值；showChatUpdates 默认开启。
  const name = draft.name ?? identity?.name ?? '';
  const tone = draft.tone ?? identity?.tone ?? 'warm';
  const avatar = draft.avatar ?? identity?.avatar ?? '';
  const showChatUpdates = draft.showChatUpdates ?? identity?.showChatUpdates ?? true;
  // 存量 avatar 可能是三色之外的旧值（如图片路径）：照原样回显与提交，不静默改成 sky。
  const avatarKnown = AVATARS.some((item) => item.value === avatar);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const body = (
    <>
      {!embedded && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[11] }}>
          <IconBox icon={Bot} size={sizing[42]} tint={colors.avatarSky} iconColor={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>助手身份</Text>
            <Text style={{ ...typography.small, color: colors.muted }}>
              名字与语气会注入每一轮对话
            </Text>
          </View>
        </View>
      )}
      {embedded && <SectionHeading title="助手偏好" />}
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
        <Text style={{ ...typography.small, fontWeight: '600', color: colors.ink }}>头像</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="头像" style={styles.optionRow}>
          {AVATARS.map((item) => {
            const active = avatar === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityLabel={`${item.label}头像`}
                aria-checked={active} aria-disabled={busy}
                disabled={busy}
                onPress={() => {
                  if (saving.current) return;
                  setDraft((previous) => ({ ...previous, avatar: item.value }));
                  setSaved(false);
                }}
                style={[styles.avatarOption, active && { borderColor: colors.ink, backgroundColor: item.tint }]}
              >
                <Bot size={sizing[24]} color={colors.ink} />
              </Pressable>
            );
          })}
        </View>
        <Text style={{ ...typography.small, color: colors.muted }}>
          {avatar && !avatarKnown
            ? '当前使用自定义头像，选一个底色可切换。'
            : '只影响客户端配色，不会替换任何图片资源。'}
        </Text>
      </View>
      <View style={{ gap: spacing.sm }}>
        <Text style={{ ...typography.small, fontWeight: '600', color: colors.ink }}>语气</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="语气" style={styles.optionRow}>
          {TONES.map((item) => {
            const active = tone === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                aria-checked={active} aria-disabled={busy}
                disabled={busy}
                onPress={() => {
                  if (saving.current) return;
                  setDraft((previous) => ({ ...previous, tone: item.value === identity?.tone ? undefined : item.value }));
                  setSaved(false);
                }}
                style={[styles.chip, active && { backgroundColor: colors.tabActive }]}
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
      <CheckRow
        label="在聊天里显示进度更新"
        checked={showChatUpdates}
        onPress={() => {
          if (saving.current) return;
          setDraft((previous) => ({ ...previous, showChatUpdates: !showChatUpdates }));
          setSaved(false);
        }}
      />
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
            // 四字段一并提交：未改字段取当前显示值（含快照回填），保证保存后身份完整。
            await api.saveIdentity({ name: name.trim(), tone, avatar: avatar || undefined, showChatUpdates });
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
    </>
  );

  if (embedded) {
    // Sheet 内直接铺内容，不再套一层白卡。
    return <View style={{ gap: spacing[14] }}>{body}</View>;
  }
  return <Card style={{ gap: spacing[14] }}>{body}</Card>;
}

const styles = StyleSheet.create({
  optionRow: { flexDirection: 'row', gap: spacing.sm },
  /** 头像单选格：选中态用 ink 描边示意，不引入图片 */
  avatarOption: {
    width: sizing[58],
    height: sizing[58],
    borderRadius: radius[22],
    borderWidth: sizing.borderWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
  },
});
