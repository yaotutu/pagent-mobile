import './register-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSseFrames } from '../src/api/sse.ts';

const started = { type: 'TEXT_MESSAGE_START', messageId: 'active', role: 'assistant' };
const delta = { type: 'TEXT_MESSAGE_CONTENT', messageId: 'active', delta: '中文增量' };
const frame = (event, newline = '\n') => `data: ${JSON.stringify(event)}${newline}${newline}`;

// 模拟调用方把 rest 原样拼到下个 chunk；不依赖 fetch、字节解码器或真实服务端。
const parseChunks = (chunks) => chunks.reduce(({ events, rest }, chunk) => {
  const parsed = parseSseFrames(rest + chunk);
  return { events: [...events, ...parsed.events], rest: parsed.rest };
}, { events: [], rest: '' });

test('LF、CRLF 及混合帧按到达顺序解析，未闭合尾部原样返回', () => {
  const tail = 'data: {"type":"TEXT_MESSAGE_END"}\r';
  assert.deepEqual(parseSseFrames(frame(started) + frame(delta, '\r\n') + tail), {
    events: [started, delta], rest: tail,
  });
});

test('每一个可能的 chunk 切分位置都不能丢失或重复事件', () => {
  const stream = frame(started, '\r\n') + frame(delta) + frame({ type: 'RUN_FINISHED' }, '\r\n');
  const expected = { events: [started, delta, { type: 'RUN_FINISHED' }], rest: '' };
  // 包括恰好切在 \r 与 \n 之间、JSON 字符串内部及完整边界两侧的情况。
  for (let split = 0; split <= stream.length; split++) {
    assert.deepEqual(parseChunks([stream.slice(0, split), stream.slice(split)]), expected, `切分位置 ${split}`);
  }
  assert.deepEqual(parseChunks([...stream]), expected);
});

test('空缓冲和不完整帧不会提前派发事件', () => {
  for (const rest of ['', 'data: ', frame(delta, '\r\n').slice(0, -1), '\r']) {
    assert.deepEqual(parseSseFrames(rest), { events: [], rest });
  }
});

test('注释、event/id 元数据、空 data 和坏 JSON 不影响后续正常事件', () => {
  const ignored = ': heartbeat\r\nevent: message\r\nid: 1\r\ndata: \r\ndata: not-json\r\n\r\n';
  assert.deepEqual(parseSseFrames(ignored + frame(delta, '\r\n')), { events: [delta], rest: '' });
});

test('保持服务端逐 data 行的 JSON 契约，不拼接为另一个 JSON', () => {
  const buffer = `event: message\r\ndata: ${JSON.stringify(started)}\r\ndata: ${JSON.stringify(delta)}\r\n\r\n`;
  assert.deepEqual(parseSseFrames(buffer), { events: [started, delta], rest: '' });
});

test('RUN_ERROR 仍作为普通协议事件交由聚合器消费', () => {
  const event = { type: 'RUN_ERROR', code: 'BUSY', message: '请稍后再试' };
  assert.deepEqual(parseSseFrames(frame(event, '\r\n')), { events: [event], rest: '' });
});
