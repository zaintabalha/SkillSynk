/** Keep provider diagnostics in the response, but show only localized action copy in the UI. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback;
  const data = error.data;
  if (!data || typeof data !== 'object' || !('code' in data)) return fallback;
  const code = String(data.code);
  const arabic = typeof document !== 'undefined' &&
    document.documentElement.lang.toLowerCase().startsWith('ar');
  if (code === 'AI_QUOTA_EXCEEDED') {
    return arabic
      ? 'بلغ SkillSync AI حدّ الطلبات الحالي. حاول مجدداً بعد إعادة تعيين الحصة، أو راجع حصة المشروع وفوترته.'
      : 'SkillSync AI has reached its current request quota. Try again after it resets, or check the project’s AI quota and billing.';
  }
  if (code === 'AI_LIMIT_EXCEEDED') {
    const retryAfter = 'retryAfterSeconds' in data && typeof data.retryAfterSeconds === 'number'
      ? data.retryAfterSeconds
      : null;
    if (arabic) return retryAfter
      ? `SkillSync AI مشغول حالياً. حاول مجدداً بعد ${retryAfter} ثانية.`
      : 'SkillSync AI مشغول حالياً. حاول مجدداً بعد قليل.';
    return retryAfter
      ? `SkillSync AI is busy. Try again in ${retryAfter} seconds.`
      : 'SkillSync AI is busy. Please try again shortly.';
  }
  return fallback;
}
