/**
 * token 持久化：原生用 expo-secure-store（钥匙串级存储），Web 调试用
 * localStorage（secure-store 无 Web 实现）。上层只管调用，不感知平台。
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'pagent-token';

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
