/**
 * ApiClient 注入点：App 顶层挂一次，页面经 useApi() 取用。
 * mock 阶段注入 MockApiClient，接口阶段替换为 HttpApiClient，页面代码不动。
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ApiClient } from './api';

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi 必须在 ApiProvider 内使用');
  return client;
}
