// 未来所有本地业务缓存仅在这里清理，不得删除服务器配置或凭证记录。
export function clearLocalWorkspaceData(): Promise<void> {
  return Promise.resolve();
}
