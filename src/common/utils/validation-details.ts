import { ValidationError } from 'class-validator';

export type ValidationDetail = {
  field: string;
  message: string;
};

/**
 * Chuyển lỗi class-validator thành danh sách field/message ổn định theo hợp đồng API.
 *
 * @param errors Mảng ValidationError từ ValidationPipe.
 * @param parentPath Đường dẫn field lồng nhau (nếu có).
 * @returns Chi tiết validation theo từng field.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationDetail[] {
  const details: ValidationDetail[] = [];

  for (const error of errors) {
    const field = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      const message = Object.values(error.constraints)[0];
      details.push({ field, message });
    }

    if (error.children?.length) {
      details.push(...flattenValidationErrors(error.children, field));
    }
  }

  return details;
}
