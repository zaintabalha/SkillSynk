/** Show the server's bilingual retry guidance, retaining existing messages for other failures. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback;
  const data = error.data;
  if (!data || typeof data !== 'object' || !('code' in data) || data.code !== 'AI_LIMIT_EXCEEDED') return fallback;
  return 'error' in data && typeof data.error === 'string' ? data.error : fallback;
}
