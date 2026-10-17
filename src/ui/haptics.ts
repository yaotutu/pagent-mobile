/**
 * 跨平台触觉反馈（Haptics）工具。
 * 在 iOS / Android 原生调用轻触震动；在 Web 或无震动硬件上静默放行，不抛错。
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export async function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(style);
  } catch {
    // 忽略不支持平台或权限错误
  }
}

export async function hapticNotification(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(type);
  } catch {
    // 忽略不支持平台或权限错误
  }
}

export async function hapticSelection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // 忽略不支持平台或权限错误
  }
}
