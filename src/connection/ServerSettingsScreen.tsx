// 测试结果仅属于当前草稿，不代表已保存或允许复用旧凭证。
import { Server } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeServerAddress } from './server-address';
import type { ConnectionTest, ServerSettingsScreenProps } from './types';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { Card, IconBox } from '../ui/Surfaces';
import { colors, layout, radius, sizing, spacing, typography } from '../ui/tokens';

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; test: ConnectionTest }
  | { kind: 'failed'; message: string };

export function ServerSettingsScreen({
  currentServerUrl,
  busy,
  onTest,
  onCancelTest,
  onSave,
  onCancel,
}: ServerSettingsScreenProps) {
  const [draftUrl, setDraftUrl] = useState(currentServerUrl ?? '');
  // Key 总是空，不回填旧值；用户主动输入才走测试。
  const [draftKey, setDraftKey] = useState('');
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ url: string; test?: ConnectionTest } | null>(null);
  /** 测试请求序号：递增作废上一次结果，防晚到响应覆盖。 */
  const testSeqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      testSeqRef.current += 1;
      onCancelTest();
    };
  }, [onCancelTest]);

  const onChangeUrl = useCallback((next: string) => {
    testSeqRef.current += 1;
    onCancelTest();
    setDraftUrl(next);
    setTest({ kind: 'idle' });
  }, [onCancelTest]);

  const onChangeKey = useCallback((next: string) => {
    testSeqRef.current += 1;
    onCancelTest();
    setDraftKey(next);
    setTest({ kind: 'idle' });
  }, [onCancelTest]);

  const normalize = useCallback((): string | null => {
    try {
      return normalizeServerAddress(draftUrl);
    } catch (e) {
      setTest({ kind: 'failed', message: (e as Error).message });
      return null;
    }
  }, [draftUrl]);

  const handleTest = useCallback(async () => {
    const url = normalize();
    if (!url) return;
    setTest({ kind: 'running' });
    const seq = ++testSeqRef.current;
    try {
      const result = await onTest(url, draftKey);
      if (!mountedRef.current || seq !== testSeqRef.current) return;
      setTest({ kind: 'ok', test: result });
    } catch (e) {
      if (!mountedRef.current || seq !== testSeqRef.current) return;
      setTest((e as Error).name === 'AbortError' ? { kind: 'idle' } : { kind: 'failed', message: (e as Error).message ?? '测试失败' });
    }
  }, [draftKey, normalize, onTest]);

  const handleCancelTest = useCallback(() => {
    testSeqRef.current += 1;
    onCancelTest();
    if (test.kind === 'running') setTest({ kind: 'idle' });
  }, [onCancelTest, test.kind]);

  /** 真正写入：被 Sheet 确认或未需确认时调用。 */
  const commitSave = useCallback(
    async (url: string, key: string, passable: ConnectionTest | undefined) => {
      try { await onSave(url, key, passable); return true; }
      catch (e) {
        if (mountedRef.current) setTest({ kind: 'failed', message: (e as Error).message });
        return false;
      }
    },
    [onSave],
  );

  const handleRequestSave = useCallback(async () => {
    if (busy) return;
    const url = normalize();
    if (!url) return;

    const nextNormalized = url;
    let different = false;
    if (currentServerUrl) {
      try {
        different = normalizeServerAddress(currentServerUrl) !== nextNormalized;
      } catch {
        different = true;
      }
    } else {
      different = Boolean(nextNormalized);
    }

    // 同址且无新 Key：直接保存，不弹清空提示，也不强制测试。
    if (!different && !draftKey) {
      await commitSave(nextNormalized, '', undefined);
      return;
    }

    // 同址但带新 Key，且尚未测试成功：先测试；测试失败则不覆盖现有配置。
    if (!different && draftKey) {
      if (test.kind === 'ok') {
        await commitSave(nextNormalized, draftKey, test.test);
        return;
      }
      // 触发一次测试，测试失败不调用 onSave。
      setTest({ kind: 'running' });
      const seq = ++testSeqRef.current;
      try {
        const result = await onTest(nextNormalized, draftKey);
        if (!mountedRef.current || seq !== testSeqRef.current) return;
        setTest({ kind: 'ok', test: result });
        await commitSave(nextNormalized, draftKey, result);
      } catch (e) {
        if (!mountedRef.current || seq !== testSeqRef.current) return;
        setTest((e as Error).name === 'AbortError' ? { kind: 'idle' } : { kind: 'failed', message: (e as Error).message ?? '测试失败' });
      }
      return;
    }

    // 更换服务器：弹清空确认。
    setPendingSave({ url: nextNormalized, test: test.kind === 'ok' ? test.test : undefined });
    setResetConfirmOpen(true);
  }, [busy, currentServerUrl, draftKey, normalize, onTest, test, commitSave]);

  const handleConfirmReset = useCallback(async () => {
    if (!pendingSave) {
      setResetConfirmOpen(false);
      return;
    }
    const { url, test: passable } = pendingSave;
    if (await commitSave(url, draftKey, passable)) {
      setResetConfirmOpen(false);
      setPendingSave(null);
    }
  }, [commitSave, draftKey, pendingSave]);

  const handleCancelSheet = useCallback(() => {
    setResetConfirmOpen(false);
    setPendingSave(null);
  }, []);

  const isHttp = /^http:\/\//i.test(draftUrl.trim());
  const testButtonLabel =
    test.kind === 'running' ? '取消测试' : test.kind === 'ok' ? '重新测试' : '测试连接';
  const onTestPress = test.kind === 'running' ? handleCancelTest : handleTest;

  return (
    <SafeAreaView style={styles.canvas}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>
            <IconBox icon={Server} size={sizing[58]} iconSize={sizing[26]} tint={colors.avatarSky} iconColor={colors.accent} />
            <Text style={styles.title}>服务器设置</Text>
            <Text style={styles.subtitle}>
              {currentServerUrl
                ? '当前仅保存一个服务器地址。测试不会覆盖现有配置，确认保存后才生效。'
                : '尚未配置服务器。填写地址以连接或保存离线地址。'}
            </Text>

            <Card style={styles.card}>
              <Field
                label="服务器地址"
                value={draftUrl}
                editable={!busy}
                onChangeText={onChangeUrl}
                placeholder="https://pagent.example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Field
                label="访问 Key（可选）"
                value={draftKey}
                editable={!busy}
                onChangeText={onChangeKey}
                secureTextEntry
                placeholder="新地址使用新 Key；同地址留空可沿用 Token"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {isHttp && (
                <View style={styles.notice}>
                  <Text style={{ ...typography.small, color: colors.danger }}>
                    使用 http:// 将以明文传输数据与密钥，仅建议在受信的内网或本地开发环境使用。
                  </Text>
                </View>
              )}

              {test.kind === 'ok' && (
                <View style={styles.okRow} accessibilityRole="text">
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <Text style={{ ...typography.text, color: colors.success }}>
                    连接测试通过。
                  </Text>
                </View>
              )}
              {test.kind === 'failed' && <ErrorNotice error={test.message} />}

              <View style={styles.actions}>
                <Button primary onPress={handleRequestSave} disabled={busy || test.kind === 'running'} busy={busy}>
                  保存
                </Button>
                <Button onPress={onTestPress} disabled={busy && test.kind !== 'running'}>
                  {testButtonLabel}
                </Button>
                <Button onPress={() => { handleCancelTest(); onCancel(); }} disabled={busy}>
                  取消
                </Button>
              </View>
            </Card>

            <Text style={styles.hint}>
              更改服务器将清空本地工作区数据与旧凭证；服务器上的数据不会受影响。
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {resetConfirmOpen && (
        <Sheet title="更改服务器？" onClose={() => { if (!busy) handleCancelSheet(); }}>
          <ErrorNotice error={test.kind === 'failed' ? test.message : undefined} />
          <Text style={styles.sheetText}>
            更改服务器将清空本地工作区数据和旧凭证，不会删除服务器上的数据，是否继续？
          </Text>
          {pendingSave?.test == null && (
            <Text style={styles.sheetText}>
              新地址尚未验证，保存后需连接或认证才能使用。
            </Text>
          )}
          <View style={styles.sheetActions}>
            <Button onPress={handleCancelSheet} disabled={busy}>
              取消
            </Button>
            <Button primary onPress={handleConfirmReset} disabled={busy} busy={busy}>
              确认更改
            </Button>
          </View>
        </Sheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: spacing.section },
  column: {
    width: layout.fullWidth,
    maxWidth: layout.loginMaxWidth,
    alignSelf: 'center',
    gap: spacing[14],
    alignItems: 'center',
  },
  title: { ...typography.pageTitle, fontWeight: '500', color: colors.ink, textAlign: 'center' },
  subtitle: {
    ...typography.muted,
    color: colors.muted,
    textAlign: 'center',
  },
  card: { width: layout.fullWidth },
  notice: {
    padding: spacing.md,
    borderRadius: radius.notice,
    backgroundColor: colors.dangerBg,
    marginBottom: spacing.md,
  },
  okRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.notice,
    backgroundColor: colors.successBg,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: sizing[6],
    height: sizing[6],
    borderRadius: radius[3],
  },
  actions: { gap: spacing.md, marginTop: spacing.sm },
  hint: {
    ...typography.small,
    color: colors.muted,
    textAlign: 'center',
  },
  sheetText: { ...typography.text, color: colors.ink, marginBottom: spacing.md },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    justifyContent: 'flex-end',
  },
});