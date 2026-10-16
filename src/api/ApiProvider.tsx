/**
 * ApiClient 注入点：App 顶层挂一次，页面经 useApi() 取用。
 * 页面只读取客户端契约，具体传输实现由入口注入。
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClient } from './contracts';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi 必须在 ApiProvider 内使用');
  return client;
}
