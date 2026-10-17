/**
 * 基于 zustand 的轻量全局 UI 状态管理。
 * 管理主 Tab 视图切换、抽屉弹层显隐等跨组件 UI 状态。
 */

import { create } from 'zustand';

export type TabView = 'chat' | 'activity' | 'goals' | 'apps';

export interface UiStore {
  currentTab: TabView;
  threadsOpen: boolean;
  approvalsOpen: boolean;
  setCurrentTab: (tab: TabView) => void;
  setThreadsOpen: (open: boolean) => void;
  setApprovalsOpen: (open: boolean) => void;
  openThreads: () => void;
  closeThreads: () => void;
  openApprovals: () => void;
  closeApprovals: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  currentTab: 'chat',
  threadsOpen: false,
  approvalsOpen: false,
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setThreadsOpen: (open) => set({ threadsOpen: open }),
  setApprovalsOpen: (open) => set({ approvalsOpen: open }),
  openThreads: () => set({ threadsOpen: true }),
  closeThreads: () => set({ threadsOpen: false }),
  openApprovals: () => set({ approvalsOpen: true }),
  closeApprovals: () => set({ approvalsOpen: false }),
}));
