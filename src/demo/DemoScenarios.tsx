import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../ui/Buttons';
import { Sheet } from '../ui/Sheet';
import { colors, spacing, typography } from '../ui/tokens';
import { useDemo } from './DemoProvider';

export const DEMO_SCENARIOS = [
  ['搜索与来源', '搜索 Expo 开发文档'], ['天气卡片', '查看杭州天气'],
  ['保存记忆', '记住我喜欢周末散步'], ['后台任务', '创建一个后台旅行任务'],
  ['定时简报', '安排每周定时简报'], ['网页监控', '监控旅行页面的车票变化'],
  ['文件预览', '预览周末计划'], ['写入审批', '申请写入周末计划'],
  ['慢流与停止', '慢流演示'], ['错误与恢复', '演示一次失败'],
] as const;

export function DemoScenarios({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  const demo = useDemo();
  const [open, setOpen] = useState(false);
  if (!demo) return null;
  return <>
    <Pressable accessibilityRole="button" disabled={disabled} onPress={() => setOpen(true)} style={{ paddingVertical: spacing[7], alignSelf: 'center', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ ...typography.small, color: colors.accent }}>尝试一个演示场景</Text>
    </Pressable>
    {open && <Sheet title="体验助手的工作方式" subtitle="以下场景只操作演示内存，不查询实时天气或执行真实任务。" onClose={() => setOpen(false)}>
      <View style={{ gap: spacing.sm }}>{DEMO_SCENARIOS.map(([label, prompt]) => <Button key={label} onPress={() => { setOpen(false); onPick(prompt); }}>{label}</Button>)}</View>
    </Sheet>}
  </>;
}
