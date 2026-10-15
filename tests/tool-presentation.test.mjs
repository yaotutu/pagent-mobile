import assert from 'node:assert/strict';
import test from 'node:test';
import { parseToolRecord, toolTextField, toolOutcome } from '../src/chat/tool-presentation.ts';

// 工具数据来自模型/网络，必须验证畸形输入不会成为 React 对象节点或伪造成功。
test('工具参数兼容截断、null、数组和非字符串字段', () => {
  for (const raw of ['null', '[]', '{"path":', '普通文本', undefined]) {
    assert.deepEqual(parseToolRecord(raw), {});
  }
  assert.equal(toolTextField(parseToolRecord('{"path":{},"file":"notes.md"}'), 'path', 'file'), 'notes.md');
  assert.equal(toolTextField({ city: 12 }, 'city'), '');
});

test('有结果不等于保存成功，明确失败优先于成功标记', () => {
  assert.equal(toolOutcome(undefined), 'running');
  for (const raw of ['', 'Saved notes.md.', '{"id":"job-1"}', 'null']) assert.equal(toolOutcome(raw), 'finished');
  assert.equal(toolOutcome('{"saved":true}'), 'saved');
  assert.equal(toolOutcome('{"written":true}'), 'saved');
  for (const value of [{ error: '失败' }, { saved: false }, { isError: true }, { saved: true, denied: true }]) {
    assert.equal(toolOutcome(JSON.stringify(value)), 'failed');
  }
});
