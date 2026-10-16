/**
 * 时间展示工具：中文相对时间 + 绝对时间格式化。
 * 服务端时间均为 ISO 8601 字符串；解析失败原样返回，不抛错。
 */

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / 更早回落绝对日期 */
export function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  if (diff < 60e3) return '刚刚';
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)} 小时前`;
  if (diff < 2 * 86400e3) return '昨天';
  return formatDateTime(value);
}

/** 绝对时间：MM/DD HH:mm（同年省年份） */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
