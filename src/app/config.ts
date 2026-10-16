import { Platform } from 'react-native';

// Web 仅作联调；原生模拟器默认连接隔离 mock，真机需显式指定服务地址。
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? Platform.select({
  web: 'http://localhost:8791',
  android: 'http://10.0.2.2:8788',
  default: 'http://127.0.0.1:8788',
});
