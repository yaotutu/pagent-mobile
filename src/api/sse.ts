import type { AgUiEvent } from './types';

/** 按服务端逐 data 行 JSON 契约分帧，未闭合尾部原样留给下一次读取。 */
export function parseSseFrames(buffer: string): { events: AgUiEvent[]; rest: string } {
  const events: AgUiEvent[] = [];
  let rest = buffer;
  for (;;) {
    // CRLF 可能跨 chunk，不能预先替换换行符。
    const boundary = /\r?\n\r?\n/.exec(rest);
    if (!boundary) break;
    const frame = rest.slice(0, boundary.index);
    rest = rest.slice(boundary.index + boundary[0].length);
    for (const line of frame.split(/\r?\n/)) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        events.push(JSON.parse(payload) as AgUiEvent);
      } catch {
        // 非 JSON 帧忽略；运行错误由 RUN_ERROR 事件表达。
      }
    }
  }
  return { events, rest };
}
