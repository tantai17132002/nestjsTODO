import { BaseQueryDto } from '@/common/dto/pagination.dto';

/**
 * DTO cho việc truy vấn danh sách users với pagination
 *
 * Extends từ BaseQueryDto để có pagination cơ bản
 * Chỉ admin mới có quyền truy cập endpoint này
 *
 * @example
 * GET /users?page=1&limit=10
 */
export class QueryUserDto extends BaseQueryDto {
  // Ví dụ: search, role filter, date range, etc.
}
