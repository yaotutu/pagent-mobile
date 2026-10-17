/**
 * 全局轻提示（toast）：操作反馈的统一出口（已批准/已保存/已删除…）。
 * 形态对照 OpenMuse：墨色胶囊浮于底部 tab bar 上方，5.5s 自动消失，可手动关闭。
 * 页面通过 useToast() 取 showToast(message)；Provider 只在 App 挂一次。
 */

import { Check, X } from 'lucide-react-native';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { colors, layout, radius, sizing, spacing, typography } from './tokens';

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={setToast}>
      {children}
      {!!toast && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          exiting={FadeOutDown.duration(200)}
          pointerEvents="box-none"
          style={styles.wrap}
        >
          <View style={styles.pill}>
            <Check size={sizing[16]} color={colors.bubbleUser} />
            <Text style={styles.text}>{toast}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="关闭提示"
              onPress={() => setToast('')}
            >
              <X size={sizing[16]} color={colors.card} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: layout.toastBottom,
    left: spacing[20],
    right: spacing[20],
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[10],
    padding: spacing[14],
    backgroundColor: colors.ink,
    borderRadius: radius.chip,
    maxWidth: layout.toastMaxWidth,
  },
  text: { color: colors.card, fontSize: typography.small.fontSize, flexShrink: 1 },
});
