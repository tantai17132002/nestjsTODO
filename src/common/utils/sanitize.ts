const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'secret',
  'key',
  'authorization',
  'jwt',
  'db_pass',
]);

/**
 * Ẩn đệ quy các field nhạy cảm trước khi ghi log.
 *
 * @param value Dữ liệu bất kỳ từ request hoặc exception.
 * @returns Bản sao đã che field nhạy cảm.
 */
export function sanitizeForLog(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        return [key, '[REDACTED]'];
      }
      return [key, sanitizeForLog(nested)];
    });
    return Object.fromEntries(entries);
  }

  return value;
}
