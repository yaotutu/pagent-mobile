export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export function requestCancelled() {
  const error = new Error('请求已取消，未确认的操作请刷新后核对');
  error.name = 'AbortError';
  return error;
}

export function isRequestCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
