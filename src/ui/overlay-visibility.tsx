import { createContext, useContext, type ReactNode } from 'react';

const OverlayVisibility = createContext(true);
export function OverlayVisibilityProvider({ visible, children }: { visible: boolean; children: ReactNode }) {
  return <OverlayVisibility.Provider value={visible}>{children}</OverlayVisibility.Provider>;
}
export function useOverlayVisibility() { return useContext(OverlayVisibility); }
