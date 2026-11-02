/** Keep provider diagnostics in the response, but show only localized action copy in the UI. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback;
  const data = error.data;
  if (
    !data ||
    typeof data !== 'object' ||
    !('code' in data) ||
    !['AI_LIMIT_EXCEEDED', 'AI_MODEL_UNAVAILABLE', 'AI_PROVIDER_ERROR', 'INTERNAL_SERVER_ERROR'].includes(String(data.code))
  ) return fallback;
  return fallback;
}
