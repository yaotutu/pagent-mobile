// 里程碑仅创建时提交，编辑端点不能接收 milestones。

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import type { GoalInput } from '../api/contracts';
import type { Goal } from '../api/types';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { spacing } from '../ui/tokens';

const goalSchema = z.object({
  title: z.string().min(1, '目标标题不能为空'),
  description: z.string().optional(),
  category: z.string().optional(),
  milestonesText: z.string().optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const { control, handleSubmit } = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: goal?.title ?? '',
      description: goal?.description ?? '',
      category: goal?.category ?? initialCategory ?? '',
      milestonesText: '',
    },
  });

  const onValid = async (values: GoalFormValues) => {
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        category: values.category?.trim() || undefined,
        milestones: goal
          ? undefined
          : values.milestonesText
              ?.split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <ErrorNotice error={error} />
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="目标标题"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="例如：完成移动端 v1"
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="描述（可选）"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="一两句话说清这个目标"
              multiline
            />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="分类（可选）"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="如 fitness / study / product"
            />
          )}
        />
        {!goal && (
          <Controller
            control={control}
            name="milestonesText"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="里程碑（可选，每行一个）"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={'组件库\n聊天链路\nAndroid 冒烟'}
                multiline
              />
            )}
          />
        )}
        <Button
          primary
          icon={Plus}
          busy={busy}
          onPress={handleSubmit(onValid, (errors) => {
            if (errors.title?.message) {
              setError(errors.title.message);
            }
          })}
        >
          保存
        </Button>
      </View>
    </Sheet>
  );
}
