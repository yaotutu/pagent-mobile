import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { registerHooks } from 'node:module';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const httpApiPath = fileURLToPath(new URL('src/lib/http-api.ts', root));
const apiPath = fileURLToPath(new URL('src/lib/api.ts', root));

// Node 测试环境没有 Expo 原生模块；把 Expo fetch 边界映射为动态读取全局 fetch，
// 使每个用例都能注入本地假响应，同时保留生产模块的 HTTP/SSE 实现。
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo/fetch') {
      return {
        url: `data:text/javascript,${encodeURIComponent('export const fetch = (...args) => globalThis.fetch(...args);')}`,
        shortCircuit: true,
      };
    }
    if (specifier === './api' && context.parentURL === pathToFileURL(httpApiPath).href) {
      return { url: pathToFileURL(apiPath).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === pathToFileURL(httpApiPath).href || url === pathToFileURL(apiPath).href) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      return { format: 'module', source: output.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

const { HttpApiClient } = await import('../src/lib/http-api.ts');
const { ApiError } = await import('../src/lib/api.ts');

const withFetch = async (fetchImpl, callback) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('getConversation 保留 revision 与 messages 响应结构', async () => {
  const conversation = { revision: 'rev-17', messages: [{ id: 'message-1', role: 'user', content: '你好' }] };
  await withFetch(async (url) => {
    assert.equal(url, 'https://api.example/api/conversation?threadId=thread%2F%E4%B8%80');
    return jsonResponse(conversation);
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => undefined, () => {});
    assert.deepEqual(await client.getConversation('thread/一'), conversation);
  });
});

test('stopRun 使用 threadId 与 runId 调用 conversation stop 契约', async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.example/api/conversation/stop');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { threadId: 'thread/一', runId: 'run-2' });
    return jsonResponse({ stopped: true });
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => 'secret', () => {});
    assert.equal(await client.stopRun('thread/一', 'run-2'), true);
  });
});

test('getSnapshot 合并 agent 快照与 pending actions', async () => {
  const snapshot = {
    tasks: [], goals: [], monitors: [], memories: [],
    identity: { name: '', tone: '' }, worker: { running: false },
  };
  const approval = { id: 'approval-1', status: 'pending' };
  await withFetch(async (url) => {
    if (url === 'https://api.example/api/agent') return jsonResponse(snapshot);
    if (url === 'https://api.example/api/actions/pending') return jsonResponse({ actions: [approval] });
    assert.fail(`意外请求：${url}`);
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => undefined, () => {});
    assert.deepEqual(await client.getSnapshot(), { ...snapshot, notifications: [approval] });
  });
});

test('getTask 保留 task 与 events 详情响应结构', async () => {
  const detail = { task: { id: 'task/1', title: '任务' }, events: [{ id: 'event-1' }] };
  await withFetch(async (url) => {
    assert.equal(url, 'https://api.example/api/agent/tasks/task%2F1');
    return jsonResponse(detail);
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => undefined, () => {});
    assert.deepEqual(await client.getTask('task/1'), detail);
  });
});

test('controlTask 将必需 target 原样放入请求体', async () => {
  const targets = ['job', 'task'];
  let requestIndex = 0;
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.example/api/agent/tasks/task-1/control');
    assert.equal(init.method, 'POST');
    assert.deepEqual(JSON.parse(init.body), { action: 'cancel', target: targets[requestIndex] });
    requestIndex += 1;
    return jsonResponse({ id: 'task-1' });
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => undefined, () => {});
    for (const target of targets) await client.controlTask('task-1', 'cancel', target);
  });
  assert.equal(requestIndex, targets.length);
});

test('401 触发注入回调并抛出带状态码的 ApiError', async () => {
  let unauthorizedCalls = 0;
  await withFetch(async (_url, init) => {
    assert.equal(init.headers.authorization, 'Bearer token-1');
    return jsonResponse({ error: 'expired' }, 401);
  }, async () => {
    const client = new HttpApiClient('https://api.example', () => 'token-1', () => { unauthorizedCalls += 1; });
    await assert.rejects(client.listThreads(), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      return true;
    });
    assert.equal(unauthorizedCalls, 1);
  });
});

test('HTTP 非成功响应解析服务端 error 消息', async () => {
  await withFetch(async () => jsonResponse({ error: '任务冲突' }, 409), async () => {
    const client = new HttpApiClient('https://api.example', () => undefined, () => {});
    await assert.rejects(client.listThreads(), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 409);
      assert.equal(error.message, '任务冲突');
      return true;
    });
  });
});

test('SSE 收到终止事件正常完成；无终止事件的 EOF 报连接中断', async () => {
  const makeClient = () => new HttpApiClient('https://api.example', () => undefined, () => {});
  const runInput = {
    threadId: 'thread-1',
    runId: 'run-1',
    expectedRevision: 'rev-17',
    message: { id: 'message-1', content: '你好' },
  };
  const terminalEvent = { type: 'RUN_FINISHED' };
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.example/api/conversation/run');
    assert.equal(init.method, 'POST');
    const requestBody = JSON.parse(init.body);
    assert.deepEqual(requestBody, runInput);
    assert.equal('messages' in requestBody, false);
    assert.equal('state' in requestBody, false);
    assert.equal('tools' in requestBody, false);
    return new Response(`data: ${JSON.stringify(terminalEvent)}\n\n`);
  }, async () => {
    const events = [];
    await makeClient().runAgent(runInput, (event) => events.push(event));
    assert.deepEqual(events, [terminalEvent]);
  });
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://api.example/api/conversation/run');
    assert.deepEqual(JSON.parse(init.body), runInput);
    return new Response('data: {"type":"TEXT_MESSAGE_START","messageId":"m1"}\n\n');
  }, async () => {
    await assert.rejects(
      makeClient().runAgent(runInput, () => {}),
      /回复连接意外中断/,
    );
  });
});
