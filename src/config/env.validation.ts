/**
 * Xác thực biến môi trường bắt buộc ngay khi ứng dụng khởi động.
 *
 * @param config Object cấu hình đọc từ process.env.
 * @returns Cấu hình đã kiểm tra.
 * @throws Error khi thiếu biến bắt buộc hoặc JWT secret rỗng.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME', 'JWT_SECRET'];
  const missing = required.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return config;
}
