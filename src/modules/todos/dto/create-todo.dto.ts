import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO tạo todo mới. ownerId luôn lấy từ JWT, không nhận từ client.
 */
export class CreateTodoDto {
  @ApiProperty({
    description: 'Tiêu đề todo, bắt buộc và không được chỉ gồm khoảng trắng',
    example: 'Learn TypeScript',
    required: true,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Mô tả chi tiết (tùy chọn)',
    example: 'Review the basics of TypeScript',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Trạng thái hoàn thành, mặc định false nếu không gửi',
    example: false,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isDone?: boolean;
}
