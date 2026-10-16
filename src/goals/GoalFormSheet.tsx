// 里程碑仅创建时提交，编辑端点不能接收 milestones。

import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { GoalInput } from '../api/contracts';
import type { Goal } from '../api/types';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { spacing } from '../ui/tokens';

export function GoalFormSheet({
  title,
  goal,
  initialCategory,
  onClose,
  onSubmit,
}: {
  title: string;
  goal?: Goal;
  /** 创建入口预填的分类（健康/关系/财务/其他）；编辑态忽略，仍以 goal 为准。 */
  initialCategory?: string;
  onClose: () => void;
  onSubmit: (input: GoalInput) => Promise<void>;
}) {
  const [form, setForm] = useState<GoalInput>({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    category: goal?.category ?? initialCategory ?? '',
    milestones: [],
  });
  const [milestonesText, setMilestonesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  return (
    <Sheet title={title} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <ErrorNotice error={error} />
        <Field
          label="目标标题"
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="例如：完成移动端 v1"
        />
        <Field
          label="描述（可选）"
          value={form.description}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="一两句话说清这个目标"
          multiline
        />
        <Field
          label="分类（可选）"
          value={form.category}
          onChangeText={(category) => setForm((f) => ({ ...f, category }))}
          placeholder="如 fitness / study / product"
        />
        {!goal && (
          <Field
            label="里程碑（可选，每行一个）"
            value={milestonesText}
            onChangeText={setMilestonesText}
            placeholder={'组件库\n聊天链路\nAndroid 冒烟'}
            multiline
          />
        )}
        <Button
          primary
          icon={Plus}
          busy={busy}
          onPress={async () => {
            if (!form.title.trim()) {
              setError('目标标题不能为空');
              return;
            }
            setBusy(true);
            setError(undefined);
            try {
              await onSubmit({
                ...form,
                title: form.title.trim(),
                milestones: goal
                  ? undefined
                  : milestonesText
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean),
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
            }
          }}
        >
          保存
        </Button>
      </View>
    </Sheet>
  );
}
