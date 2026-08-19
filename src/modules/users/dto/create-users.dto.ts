import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '@/common/utils/normalize';

/**
 * DTO đăng ký user. Client không được gửi role; user mới luôn là `user`.
 */
export class CreateUsersDto {
  @ApiProperty({
    description: 'Tên đăng nhập, bắt buộc và không được chỉ gồm khoảng trắng',
    example: 'john_doe',
    required: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Email; được chuẩn hóa lowercase trước khi lưu',
    example: 'john@example.com',
    required: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Mật khẩu, tối thiểu 8 ký tự',
    example: 'password123',
    required: true,
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;
}
