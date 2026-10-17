import { createContext, useContext, type ReactNode } from 'react';
import type { ConnectionSnapshot } from './types';

type ServiceConnection = {
  snapshot: ConnectionSnapshot;
  enabled: boolean;
  retry: () => void;
  changeServer: () => void;
};
const Context = createContext<ServiceConnection | null>(null);
export function ConnectionProvider({ value, children }: { value: ServiceConnection; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useServiceConnection() { return useContext(Context); }
