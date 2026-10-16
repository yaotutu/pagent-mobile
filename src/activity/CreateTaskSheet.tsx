/**
 * 弹层：新建后台任务。
 *
 * 协议边界：创建请求只提交「指令 + 可选标题」，标题留空时由服务端截取指令开头；
 * 任务本身在独立会话中执行，本表单只负责本地校验与提交态。
 */

import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useApi } from '../api/ApiProvider';
import { Button } from '../ui/Buttons';
import { ErrorNotice } from '../ui/Feedback';
import { Field } from '../ui/Field';
import { Sheet } from '../ui/Sheet';
import { spacing } from '../ui/tokens';

export function CreateTaskSheet({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const api = useApi();
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <Sheet title="新建后台任务" subtitle="任务将在独立会话中执行，完成后通知你" onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <ErrorNotice error={error} />
        <Field
          label="任务标题（可选）"
          value={title}
          onChangeText={setTitle}
          placeholder="默认截取指令开头"
        />
        <Field
          label="任务指令"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="完整自包含的指令：任务会在独立会话执行，工具可用"
          multiline
        />
        <Button
          primary
          icon={Plus}
          busy={busy}
          onPress={async () => {
            if (!prompt.trim()) {
              setError('任务指令不能为空');
              return;
            }
            setBusy(true);
            setError(undefined);
            try {
              await api.createTask(prompt.trim(), title.trim() || undefined);
              onCreated();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          创建任务
        </Button>
      </View>
    </Sheet>
  );
}
