import { IsBooleanString, IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BaseQueryDto } from '@/common/dto/pagination.dto';
import { IsValidDateRange } from '@/common/validators/date-range.validator';

/**
 * Query danh sách todo: phân trang, lọc, tìm kiếm và sắp xếp theo hợp đồng API.
 */
export class QueryTodoDto extends BaseQueryDto {
  @ApiProperty({
    description: 'Lọc theo trạng thái hoàn thành',
    example: 'true',
    required: false,
    enum: ['true', 'false'],
  })
  @IsBooleanString()
  @IsOptional()
  isDone?: string;

  @ApiProperty({
    description: 'Tìm một phần trong title hoặc description, không phân biệt hoa thường',
    example: 'typescript',
    required: false,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description: 'Lọc todo tạo từ thời điểm này (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @ApiProperty({
    description: 'Lọc todo tạo đến thời điểm này (ISO 8601); phải >= dateFrom nếu cả hai có mặt',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  @IsValidDateRange()
  dateTo?: string;

  @ApiProperty({
    description: 'Cột sắp xếp được phép',
    example: 'createdAt',
    required: false,
    enum: ['id', 'title', 'isDone', 'createdAt', 'updatedAt'],
  })
  @IsIn(['id', 'title', 'isDone', 'createdAt', 'updatedAt'])
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiProperty({
    description: 'Thứ tự sắp xếp',
    example: 'desc',
    required: false,
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
