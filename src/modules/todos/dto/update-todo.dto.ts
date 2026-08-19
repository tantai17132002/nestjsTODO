import { IsBoolean, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO cập nhật todo. Chỉ nhận title, description, isDone; body rỗng bị từ chối ở service.
 */
export class UpdateTodoDto {
  @ApiProperty({
    description: 'Tiêu đề mới; nếu gửi phải khác chuỗi rỗng',
    example: 'Learn Advanced TypeScript',
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiProperty({
    description: 'Mô tả mới (tùy chọn)',
    example: 'Review the basics of TypeScript',
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Trạng thái hoàn thành mới (tùy chọn)',
    example: true,
    required: false,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isDone?: boolean;
}
