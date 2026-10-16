import assert from 'node:assert/strict';
import test from 'node:test';
import { parseToolRecord, toolTextField, toolOutcome, toolResultContent } from '../src/chat/tool-presentation.ts';

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

test('结构化失败原因与标题同时保留，错误对象仍可原文核对', () => {
  assert.deepEqual(toolResultContent('{"title":"任务标题","error":"保存失败"}'), {
    summary: '任务标题', failure: '保存失败', fallback: undefined,
  });
  assert.deepEqual(toolResultContent('{"error":{"message":"未知形状"}}'), {
    summary: '', failure: '', fallback: '{"error":{"message":"未知形状"}}',
  });
});

test('普通文本、截断与未知结果不能因空对象为truthy而丢失', () => {
  for (const raw of ['普通结果文本', '{"title":', '{}', 'null', '[]', '{"status":"unknown"}']) {
    assert.equal(toolResultContent(raw).fallback, raw);
  }
  assert.equal(toolResultContent(undefined).fallback, undefined);
  assert.deepEqual(toolResultContent('{"text":"已记住"}'), {
    summary: '已记住', failure: '', fallback: undefined,
  });
});
