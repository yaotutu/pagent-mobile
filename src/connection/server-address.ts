export function normalizeServerAddress(input: string): string {
  const text = input.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error('请输入完整的服务器地址，例如 https://域名 或 http://IP:端口');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('服务器地址只支持 http:// 或 https://');
  if (url.username || url.password) throw new Error('请勿在地址中包含账号或密码，访问 Key 应填写在单独的输入框');
  if (text.includes('?') || text.includes('#')) throw new Error('请填写服务器基础地址，不包含查询参数或 # 片段');
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}
