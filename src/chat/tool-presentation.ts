/**
 * 工具展示只解析可验证的结构，不从自然语言猜测执行成功或审批决定。
 * SSE 的结果契约是文本，历史还可能截断；JSON 不完整时必须保留原文。
 */
export const parseToolRecord = (raw?: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(raw ?? '');
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
};

/** 外部参数即使是合法 JSON，也不能直接把对象作为 React 文本节点。 */
export const toolTextField = (record: Record<string, unknown>, ...keys: string[]): string => {
  const value = keys.map((key) => record[key]).find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : '';
};

/** 仅接受明确的结构化结果；有结果不等于执行成功，更不等于已获批准。 */
export const toolOutcome = (raw?: string): 'running' | 'failed' | 'saved' | 'finished' => {
  if (raw === undefined) return 'running';
  const result = parseToolRecord(raw);
  if (result.isError === true || result.success === false || result.saved === false || result.written === false || result.error || result.denied === true) return 'failed';
  if (result.saved === true || result.written === true) return 'saved';
  return 'finished';
};
