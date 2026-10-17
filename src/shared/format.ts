/**
 * 时间展示工具：基于 dayjs 的中文相对时间 + 绝对时间格式化。
 * 服务端时间均为 ISO 8601 字符串；解析失败原样返回，不抛错。
 */

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / 更早回落绝对日期 */
export function timeAgo(value: string): string {
  const d = dayjs(value);
  if (!d.isValid()) return value;
  const diffMs = Date.now() - d.valueOf();
  if (diffMs < 60e3) return '刚刚';
  if (diffMs < 3600e3) return `${Math.floor(diffMs / 60e3)} 分钟前`;
  if (diffMs < 86400e3) return `${Math.floor(diffMs / 3600e3)} 小时前`;
  if (diffMs < 2 * 86400e3) return '昨天';
  return formatDateTime(value);
}

/** 绝对时间：MM/DD HH:mm */
export function formatDateTime(value: string): string {
  const d = dayjs(value);
  if (!d.isValid()) return value;
  return d.format('MM/DD HH:mm');
}
