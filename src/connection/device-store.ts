import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createConnectionStore } from './connection-store';

export const deviceConnectionStore = createConnectionStore({
  getItem: async (key) => Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: async (key, value) => {
    if (Platform.OS === 'web') localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === 'web') localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
});
