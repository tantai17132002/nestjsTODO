/**
 * Chuẩn hóa email: trim và chuyển về chữ thường trước khi lưu, so sánh unique hoặc đăng nhập.
 *
 * @param email Chuỗi email thô từ client.
 * @returns Email đã chuẩn hóa.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Trim chuỗi và loại bỏ khoảng trắng thừa ở hai đầu.
 *
 * @param value Chuỗi đầu vào.
 * @returns Chuỗi đã trim.
 */
export function trimString(value: string): string {
  return value.trim();
}
