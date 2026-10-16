import './register-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeApprovalDecisions, rememberDecision } from '../src/approvals/decisions.ts';
import { MAIN_THREAD, mainThread, newThread } from '../src/threads/thread-state.ts';

const approval = (id, status) => ({ id, status, title: id });

test('已确认决定覆盖旧 pending，弹层关闭后的历史不会重复', () => {
  const pending = [approval('a', 'pending'), approval('b', 'pending')];
  const recent = [approval('a', 'approved'), approval('c', 'denied')];
  assert.deepEqual(mergeApprovalDecisions(pending, recent), [recent[0], pending[1], recent[1]]);
  assert.equal(pending[0].status, 'pending');
});

test('服务端非 pending 状态优先，不被本地旧决定反向覆盖', () => {
  const expired = approval('a', 'expired');
  assert.deepEqual(mergeApprovalDecisions([expired], [approval('a', 'approved')]), [expired]);
});

test('最近审批决定按 ID 去重并只保留最近十项，不修改旧数组', () => {
  const previous = Array.from({ length: 10 }, (_, i) => approval(String(i), 'approved'));
  const updated = approval('3', 'denied');
  const recent = rememberDecision(previous, updated);
  assert.equal(recent[0], updated);
  assert.equal(recent.length, 10);
  assert.equal(recent.filter((item) => item.id === '3').length, 1);
  assert.equal(previous[3].status, 'approved');
  assert.equal(rememberDecision(recent, approval('new', 'approved')).at(-1).id, '8');
});

test('主会话默认值和新会话 ID 均满足接口约束', () => {
  assert.equal(mainThread().id, MAIN_THREAD);
  for (let i = 0; i < 50; i++) {
    const thread = newThread();
    assert.match(thread.id, /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/);
    assert.ok(Number.isFinite(Date.parse(thread.updatedAt)));
  }
});
