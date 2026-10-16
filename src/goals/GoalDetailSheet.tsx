// 详情、编辑与删除确认互斥挂载，避免原生平台叠加 Modal。

import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { timeAgo } from '../shared/format';
import type { Goal, GoalStatus } from '../api/types';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Sheet } from '../ui/Sheet';
import { colors, spacing, typography } from '../ui/tokens';
import { GoalCard } from './GoalCard';
import { GoalFormSheet } from './GoalFormSheet';

/** 弹层当前展示的内容；三者互斥，同时只有一个 Modal 挂载。 */
type Layer = 'detail' | 'edit' | 'remove';

export function GoalDetailSheet({
  goal,
  busy,
  error,
  onClose,
  onToggle,
  onStatus,
  onEdit,
  onRemove,
}: {
  goal: Goal;
  /** 该目标是否有写入在途，用于禁用重复操作 */
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onToggle: (milestoneId: string) => void;
  onStatus: (status: GoalStatus) => void;
  onEdit: (input: { title: string; description?: string; category?: string }) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [layer, setLayer] = useState<Layer>('detail');
  // 删除失败留在确认框内展示：目标可能已被删除或状态已迁移，重试前用户需要看到原因。
  const [removeError, setRemoveError] = useState<string>();
  const [removeBusy, setRemoveBusy] = useState(false);

  if (layer === 'edit') {
    return (
      <GoalFormSheet
        title="编辑目标"
        goal={goal}
        onClose={() => setLayer('detail')}
        onSubmit={async (input) => {
          await onEdit({ title: input.title, description: input.description, category: input.category });
          setLayer('detail');
        }}
      />
    );
  }

  if (layer === 'remove') {
    return (
      <Sheet title="删除目标" subtitle={goal.title} onClose={() => setLayer('detail')}>
        <View style={{ gap: spacing[14] }}>
          <ErrorNotice error={removeError} />
          <Text style={{ ...typography.muted, color: colors.muted }}>
            删除后不可恢复，里程碑记录一并清除。
          </Text>
          <View style={styles.actionRow}>
            <Button onPress={() => setLayer('detail')}>取消</Button>
            <Button
              danger
              icon={Trash2}
              busy={removeBusy}
              onPress={async () => {
                setRemoveBusy(true);
                setRemoveError(undefined);
                try {
                  await onRemove();
                } catch (e) {
                  setRemoveError(e instanceof Error ? e.message : String(e));
                } finally {
                  setRemoveBusy(false);
                }
              }}
            >
              删除
            </Button>
          </View>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet title={goal.title} subtitle={`更新于 ${timeAgo(goal.updatedAt)}`} onClose={onClose}>
      <ErrorNotice error={error} />
      <GoalCard
        goal={goal}
        busy={busy}
        onToggle={onToggle}
        onStatus={onStatus}
        onEdit={() => setLayer('edit')}
        onRemove={() => {
          setRemoveError(undefined);
          setLayer('remove');
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
