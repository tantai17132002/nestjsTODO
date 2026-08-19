import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO đăng nhập bằng username hoặc email.
 */
export class LoginDto {
  @ApiProperty({
    description: 'Username hoặc email',
    example: 'john_doe',
    required: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  usernameOrEmail: string;

  @ApiProperty({
    description: 'Mật khẩu, tối thiểu 8 ký tự',
    example: 'password123',
    required: true,
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
