import type { ThreadInfo } from '../api/types';

export const MAIN_THREAD = 'local-main';

export function mainThread(): ThreadInfo {
  return { id: MAIN_THREAD, updatedAt: new Date().toISOString() };
}

/** 服务端约束：字母开头、仅含字母数字和 _ -，长度不超过 64。 */
export function newThread(): ThreadInfo {
  return { id: `side-${Math.random().toString(36).slice(2, 10)}`, updatedAt: new Date().toISOString() };
}
