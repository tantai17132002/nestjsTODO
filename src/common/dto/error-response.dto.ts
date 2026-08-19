import { ApiProperty } from '@nestjs/swagger';

/**
 * Chi tiết lỗi validation theo từng field.
 */
export class ValidationDetailDto {
  @ApiProperty({ description: 'Tên field không hợp lệ', example: 'title' })
  field: string;

  @ApiProperty({ description: 'Thông báo validation', example: 'title should not be empty' })
  message: string;
}

/**
 * Hợp đồng lỗi API dùng chung.
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'HTTP status code', example: 400 })
  statusCode: number;

  @ApiProperty({ description: 'Thông báo lỗi', example: 'Validation failed' })
  message: string;

  @ApiProperty({
    description: 'Nhãn lỗi HTTP (tùy chọn)',
    example: 'Bad Request',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: 'Thời điểm lỗi theo ISO 8601',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({ description: 'Đường dẫn request', example: '/todos' })
  path: string;

  @ApiProperty({
    description: 'Chi tiết validation theo field (tùy chọn)',
    type: [ValidationDetailDto],
    required: false,
  })
  details?: ValidationDetailDto[];

  @ApiProperty({
    description: 'Mã request nếu client gửi header x-request-id',
    example: 'optional-request-id',
    required: false,
  })
  requestId?: string;
}

/**
 * DTO Swagger cho lỗi 400; runtime dùng field `details` như hợp đồng chung.
 */
export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Chi tiết validation theo field',
    type: [ValidationDetailDto],
    example: [{ field: 'title', message: 'title should not be empty' }],
  })
  declare details: ValidationDetailDto[];
}

/**
 * DTO Swagger cho 401.
 */
export class UnauthorizedErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Thông báo khi chưa xác thực hoặc credential sai',
    example: 'Unauthorized',
  })
  declare message: string;
}

/**
 * DTO Swagger cho 403.
 */
export class ForbiddenErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Thông báo khi đã xác thực nhưng không đủ quyền',
    example: 'Forbidden - Access denied',
  })
  declare message: string;
}

/**
 * DTO Swagger cho 404.
 */
export class NotFoundErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Thông báo khi không tìm thấy tài nguyên',
    example: 'Resource not found',
  })
  declare message: string;
}
