/**
 * Sheet 弹层（本项目唯一的弹层容器，替代导航库的详情页）。
 *
 * 双形态协议（技术定稿）：
 * - 视口宽 < layout.sheetCompactBreakpoint(600)：底部抽屉，slide 动画，
 *   顶部抓手条，底部让出安全区（刘海屏 home indicator）。
 * - ≥600（平板/桌面 Web）：居中模态，fade 动画，maxWidth 见 tokens。
 *
 * 用法：由父组件条件渲染 `{open && <Sheet .../>}`，onClose 里置 false；
 * 内容区自带纵向滚动与键盘处理。
 */

import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from './Buttons';
import { colors, layout, radius, sizing, spacing, typography } from './tokens';

export function Sheet({
  title,
  subtitle,
  children,
  onClose,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  /** 宽形态：内容较宽的弹层（如审批 diff 预览） */
  wide?: boolean;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < layout.sheetCompactBreakpoint;
  return (
    <Modal
      accessibilityLabel={title}
      transparent
      animationType={compact ? 'slide' : 'fade'}
      visible
      onRequestClose={onClose}
    >
      <View style={[styles.shade, compact && { padding: 0, justifyContent: 'flex-end' }]}>
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            wide && { maxWidth: layout.sheetWideMaxWidth },
            compact && {
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          {compact && <View style={styles.grabber} />}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={{ ...typography.title, fontWeight: '600', color: colors.ink }}>
                {title}
              </Text>
              {!!subtitle && (
                <Text style={{ ...typography.muted, color: colors.muted }}>{subtitle}</Text>
              )}
            </View>
            <IconButton icon={X} label="关闭" onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: compact ? spacing[20] : spacing.section }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shade: {
    flex: 1,
    backgroundColor: colors.shade,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[20],
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderRadius: radius.sheet,
    width: layout.fullWidth,
    maxWidth: layout.sheetMaxWidth,
    maxHeight: layout.sheetMaxHeight,
    overflow: 'hidden',
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
  },
  grabber: {
    alignSelf: 'center',
    width: sizing[34],
    height: sizing[4],
    borderRadius: radius[3],
    backgroundColor: colors.grabber,
    marginTop: spacing[10],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing[20],
    borderBottomWidth: sizing.borderWidth,
    borderBottomColor: colors.line,
  },
});
