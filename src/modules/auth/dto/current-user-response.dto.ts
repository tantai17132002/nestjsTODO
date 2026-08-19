import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO rút gọn cho GET /auth/me — lấy từ phiên JWT, không gồm email/timestamps.
 */
export class CurrentUserResponseDto {
  @ApiProperty({ description: 'ID người dùng', example: 1 })
  id: number;

  @ApiProperty({ description: 'Tên đăng nhập', example: 'john_doe' })
  username: string;

  @ApiProperty({
    description: 'Vai trò hiện tại trong JWT',
    example: 'user',
    enum: ['user', 'admin'],
  })
  role: 'user' | 'admin';
}
