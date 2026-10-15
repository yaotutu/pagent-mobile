/**
 * 设计 token —— 全项目视觉常量的唯一事实来源。
 *
 * 值逐项取自 OpenMuse 客户端（~/Desktop/code/openmuse/apps/mobile/src/ui.tsx），
 * 由 pagent-mobile 重新声明，不 import 对方代码。后续纯 Web 客户端（pagent-web）
 * 应把本文件同源翻译成 Tailwind @theme，改值只改这里，禁止在组件里散写色值/圆角。
 */

/** 颜色。命名按用途而非色相，方便整体换肤时对照替换。 */
export const colors = {
  /** 页面画布底色 */
  canvas: '#FCFCFC',
  /** 卡片底色 */
  card: '#FFFFFF',
  /** 主文字 */
  ink: '#11191C',
  /** 次级文字 */
  muted: '#697176',
  /** 描边 / 分割线 */
  line: '#EEEEF0',

  /** 用户气泡底 / 主按钮底（浅蓝） */
  bubbleUser: '#C8E7FF',
  /** 助手气泡底 / 工具卡底（灰） */
  bubbleAssistant: '#EEEEF0',
  /** 链接 / 图标 / 强调色 */
  accent: '#1473C8',

  /** 浅蓝底：iconBox、通知卡 */
  sky: '#EDF7FD',
  /** 成功底（浅绿） */
  successBg: '#E3F3E8',
  /** 成功文字 / 完成态（深绿） */
  success: '#47896C',
  /** 审核卡底（浅紫） */
  lavender: '#F0EEFA',
  /** 等待状态底（浅橙） */
  waiting: '#FDF0DF',

  /** 错误文字 */
  danger: '#AA4A45',
  /** 错误底 */
  dangerBg: '#FBEFED',

  /** 次级按钮底 */
  subtle: '#F1F2F3',
  /** 底部 tab 选中块底 */
  tabActive: '#F0F1F2',

  /** 代码块底（行内与块级统一） */
  codeBg: '#E2E4E7',

  /** 头像/iconBox 变体底色（应用页身份选择等） */
  avatarSky: '#ECF5FA',
  avatarSand: '#FAF0DF',
  avatarLilac: '#F1ECF9',
} as const;

/** 圆角体系。OpenMuse 的标志性大圆角，pill 类组件用完整半高圆角。 */
export const radius = {
  /** 卡片 */
  card: 23,
  /** Sheet 弹层 */
  sheet: 26,
  /** 消息气泡主体 */
  bubble: 22,
  /** 气泡"尾巴"角（靠发送方向一侧收小，形成方向感） */
  bubbleTail: 7,
  /** 输入框 pill */
  pill: 32,
  /** 底部 tab bar 容器 */
  tab: 40,
  /** 按钮 */
  button: 24,
  /** 表单输入框 */
  field: 19,
  /** 36×36 图标底盒 */
  iconBox: 13,
} as const;

/**
 * 字号阶梯。[字号, 行高]，个别含字距（负字距是 OpenMuse 排版特征）。
 * label 用于全大写小标签（需配合 textTransform: 'uppercase'）。
 */
export const typography = {
  /** 正文 */
  text: { fontSize: 15, lineHeight: 23 },
  /** 次级说明 */
  muted: { fontSize: 14, lineHeight: 21 },
  /** 辅助小字 */
  small: { fontSize: 11, lineHeight: 17 },
  /** 全大写标签（配 letterSpacing 1.4 与 uppercase） */
  label: { fontSize: 10, lineHeight: 14, letterSpacing: 1.4 },
  /** 页面大标题 */
  title: { fontSize: 23, lineHeight: 28, letterSpacing: -0.7 },
  /** 卡片标题 */
  heading: { fontSize: 16, lineHeight: 22, letterSpacing: -0.25 },
  /** 聊天正文（比普通正文大一档） */
  chat: { fontSize: 16, lineHeight: 24 },
  /** 空状态大标题 */
  empty: { fontSize: 28, lineHeight: 34, letterSpacing: -1 },
} as const;

/** 布局常量：内容最大宽度（桌面也是居中窄栏，不做宽屏多栏）。 */
export const layout = {
  /** 内容区最大宽度 */
  contentMaxWidth: 760,
  /** 底部 tab bar 胶囊最大宽度 */
  tabBarMaxWidth: 370,
  /** 桌面断点：只影响顶栏高度与水平 padding，不改变布局结构 */
  desktopBreakpoint: 900,
  /** Sheet 底部抽屉形态断点（小于它用 slide-up 抽屉，否则居中模态） */
  sheetCompactBreakpoint: 600,
} as const;
