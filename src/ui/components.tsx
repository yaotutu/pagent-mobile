/**
 * UI 组件原语库 —— 全项目共用的无业务组件集合。
 *
 * 职责边界：
 * - 本文件只做"纯展示/纯交互"原语：不发起网络请求、不持有业务数据、
 *   不依赖服务端类型；页面组件（src/chat 等）负责组装它们。
 * - 视觉对照 OpenMuse apps/mobile/src/ui.tsx（参考实现，代码全自研）：
 *   颜色/圆角/字号一律取自 ./tokens；组件内只允许出现自身几何尺寸
 *   （宽高/内外边距/最小高度），不得散写色值与圆角。
 * - 按压反馈遵循 OpenMuse 惯例：可点元素 pressed 时 scale 0.98 或换底色。
 */

import { ArrowUpRight, Check, ChevronRight, type LucideIcon, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, sizing, spacing, typography } from './tokens';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  /** Button 底座：胶囊形，内容横排居中 */
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing[17],
    minHeight: sizing[42],
    paddingVertical: spacing[10],
    borderRadius: radius.button,
  },
  buttonSmall: { minHeight: sizing[38], paddingVertical: spacing[7], paddingHorizontal: spacing[13] },
  buttonText: { ...typography.button, fontWeight: '600' },

  /** IconButton：44×44 正圆命中区（触控最小尺寸），白底压下变灰 */
  iconButton: {
    width: sizing.touchTarget,
    height: sizing.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius[22],
  },

  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.iconBox,
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing[20],
  },

  chip: {
    paddingHorizontal: spacing[10],
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    alignSelf: 'flex-start',
    backgroundColor: colors.canvas,
  },
  chipText: { ...typography.chip, fontWeight: '600', color: colors.muted },

  /** 表单字段：标签 + 输入框纵向排布，字段间默认下间距由使用方容器 gap 控制 */
  field: { gap: spacing[7], marginBottom: spacing.lg },
  input: {
    borderWidth: sizing.borderWidth,
    borderColor: colors.line,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: typography.chat.fontSize,
    backgroundColor: colors.card,
    minHeight: sizing.inputMinHeight,
  },

  errorNotice: {
    padding: spacing.lg,
    borderRadius: radius.notice,
    backgroundColor: colors.dangerBg,
    marginVertical: 10,
    gap: spacing.xs,
  },

  /** SectionHeading 的全大写小标签（pagent 规格定稿：区块标题用 label 样式） */
  sectionLabel: { ...typography.label, fontWeight: '700', color: colors.muted },

  /** LinkRow：图标 + 双行文字 + 右箭头的可点行 */
  linkRow: { paddingVertical: spacing[13], gap: spacing[14], borderRadius: radius.notice },

  /** CheckRow：里程碑/选项勾选行 */
  checkBox: {
    width: sizing[19],
    height: sizing[19],
    borderRadius: radius.checkRow,
    borderWidth: sizing.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /** Sheet 弹层遮罩与容器 */
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
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});

/** 主按钮（浅蓝底）/ 次按钮（灰底）通用原语；danger 只换文字与图标色。 */
export function Button({
  children,
  onPress,
  icon: Icon,
  primary,
  disabled,
  busy,
  small,
  danger,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  icon?: LucideIcon;
  /** 主形态：bubbleUser 底色 */
  primary?: boolean;
  disabled?: boolean;
  /** 忙态：图标位换成 spinner 并禁点 */
  busy?: boolean;
  small?: boolean;
  danger?: boolean;
  style?: ViewStyle;
}) {
  const color = danger ? colors.danger : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      accessibilityState={{ disabled: !!(disabled || busy), busy: !!busy }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? colors.bubbleUser : colors.subtle },
        small && styles.buttonSmall,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} size="small" />
      ) : Icon ? (
        <Icon size={sizing[15]} color={color} />
      ) : null}
      <Text style={[styles.buttonText, { color }]}>{children}</Text>
    </Pressable>
  );
}

/** 44×44 圆形图标按钮：顶栏动作、Sheet 关闭等命中区敏感的位置用。 */
export function IconButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  /** 无障碍标签（盲用读屏依赖，必填） */
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: pressed ? colors.line : colors.card },
      ]}
    >
      <Icon size={sizing[20]} strokeWidth={1.8} color={colors.ink} />
    </Pressable>
  );
}

/** 圆角图标底盒：列表行/空状态/卡片标题前的图标容器，默认 36×36。 */
export function IconBox({
  icon: Icon,
  size = 36,
  tint = colors.sky,
  iconSize = 18,
  iconColor = colors.ink,
}: {
  icon: LucideIcon;
  size?: number;
  tint?: string;
  iconSize?: number;
  iconColor?: string;
}) {
  return (
    <View style={[styles.iconBox, { width: size, height: size, backgroundColor: tint }]}>
      <Icon size={iconSize} color={iconColor} />
    </View>
  );
}

/** 白底大圆角卡片：所有页面内容容器的基本形态。 */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 小胶囊标签：分类、附注等中性标注；带色语义标注请用 StatusBadge。 */
export function Chip({ children, tint }: { children: ReactNode; tint?: string }) {
  return (
    <View style={[styles.chip, tint ? { backgroundColor: tint } : null]}>
      <Text style={styles.chipText}>{children}</Text>
    </View>
  );
}

/**
 * 状态徽章：任务/目标/监控/审批通知共用的语义色胶囊。
 * 状态字符串直接来自服务端枚举（见接口文档各端点 status 字段），
 * 新增状态未登记时回落为灰底显示原文，不会崩。
 */
const STATUS_THEME: Record<string, { bg: string; fg: string; label: string }> = {
  // 后台/定时任务 status
  queued: { bg: colors.waiting, fg: colors.ink, label: '排队中' },
  running: { bg: colors.sky, fg: colors.accent, label: '运行中' },
  scheduled: { bg: colors.sky, fg: colors.accent, label: '已排期' },
  paused: { bg: colors.subtle, fg: colors.muted, label: '已暂停' },
  succeeded: { bg: colors.successBg, fg: colors.success, label: '已完成' },
  failed: { bg: colors.dangerBg, fg: colors.danger, label: '失败' },
  cancelled: { bg: colors.subtle, fg: colors.muted, label: '已取消' },
  // 目标 status（active 与监控共用，视觉一致）
  active: { bg: colors.sky, fg: colors.accent, label: '进行中' },
  completed: { bg: colors.successBg, fg: colors.success, label: '已完成' },
  archived: { bg: colors.subtle, fg: colors.muted, label: '已归档' },
  // 监控 status
  stopped: { bg: colors.subtle, fg: colors.muted, label: '已停止' },
  // 审批通知 status
  pending: { bg: colors.waiting, fg: colors.ink, label: '待审批' },
  approved: { bg: colors.successBg, fg: colors.success, label: '已批准' },
  denied: { bg: colors.dangerBg, fg: colors.danger, label: '已拒绝' },
  expired: { bg: colors.subtle, fg: colors.muted, label: '已过期' },
};

export function StatusBadge({ status }: { status: string }) {
  const theme = STATUS_THEME[status] ?? { bg: colors.subtle, fg: colors.muted, label: status };
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={theme.label}
      style={[styles.chip, { backgroundColor: theme.bg }]}
    >
      <Text style={[styles.chipText, { color: theme.fg }]}>{theme.label}</Text>
    </View>
  );
}

/** 带标签的表单输入框：登录门、目标编辑、记忆编辑等表单统一用它。 */
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={[typography.small, { fontWeight: '600', color: colors.ink }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: sizing[120], textAlignVertical: 'top' },
          props.style,
        ]}
      />
    </View>
  );
}

/** 空状态：大图标 + 标题 + 说明（+ 可选动作，如"去创建"按钮）。 */
export function Empty({
  icon: Icon,
  title,
  detail,
  children,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', padding: spacing[40], gap: spacing[13] }}>
      <View
        style={[
          styles.iconBox,
          { width: sizing[55], height: sizing[55], borderRadius: radius.emptyIcon, backgroundColor: colors.sky },
        ]}
      >
        <Icon size={sizing[24]} color={colors.accent} />
      </View>
      <Text style={{ ...typography.heading, fontWeight: '600', color: colors.ink }}>{title}</Text>
      <Text style={{ ...typography.muted, color: colors.muted, textAlign: 'center', maxWidth: layout.emptyTextMaxWidth }}>
        {detail}
      </Text>
      {children}
    </View>
  );
}

/** 错误提示条：error 为空时整体不渲染，调用方只需把错误字符串传进来。 */
export function ErrorNotice({ error }: { error?: string }) {
  return error ? (
    <View accessibilityRole="alert" style={styles.errorNotice}>
      <Text style={{ ...typography.text, color: colors.danger }}>{error}</Text>
    </View>
  ) : null;
}

/** 区块小标题：全大写 label 样式，右侧可挂一个动作链接（如"全部 / 新建"）。 */
export function SectionHeading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[styles.between, { marginBottom: spacing[19] }]}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {action && onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={[styles.row, { gap: spacing[5] }]}
        >
          <Text style={{ ...typography.small, color: colors.ink }}>{action}</Text>
          <ArrowUpRight size={sizing[13]} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 图标 + 双行文字 + 右箭头的可点列表行：设置项、入口类列表的标准形态。 */
export function LinkRow({
  title,
  detail,
  onPress,
  icon: Icon,
  tint,
}: {
  title: string;
  detail?: string;
  onPress: () => void;
  icon: LucideIcon;
  tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.linkRow,
        pressed && { backgroundColor: colors.canvas },
      ]}
    >
      <IconBox icon={Icon} tint={tint} />
      <View style={{ flex: 1, gap: spacing[3] }}>
        <Text style={{ ...typography.text, fontWeight: '500', color: colors.ink }}>{title}</Text>
        {!!detail && (
          <Text style={{ ...typography.small, color: colors.muted }}>{detail}</Text>
        )}
      </View>
      <ChevronRight size={sizing[15]} color={colors.muted} />
    </Pressable>
  );
}

/** 勾选行：目标里程碑、选项开关等；视觉为方框勾，非 RN Switch。 */
export function CheckRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.row, { gap: spacing[10], paddingVertical: spacing[9] }]}
    >
      <View
        style={[
          styles.checkBox,
          {
            borderColor: checked ? colors.ink : colors.line,
            backgroundColor: checked ? colors.ink : colors.card,
          },
        ]}
      >
        {checked && <Check size={sizing[13]} color={colors.card} />}
      </View>
      <Text style={{ ...typography.text, color: colors.ink, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

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
              paddingBottom: Math.max(insets.bottom, 12),
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
            contentContainerStyle={{ padding: compact ? 20 : 24 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
