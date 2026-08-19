import { ApiProperty } from '@nestjs/swagger';
import { TodoResponseDto } from './todo-response.dto';
import { PaginationMetaDto } from '@/common/dto/pagination.dto';

/**
 * FiltersMetaDto - DTO cho metadata filters đã áp dụng
 */
export class FiltersMetaDto {
  @ApiProperty({
    description: 'Filter by completion status',
    example: 'true',
    required: false,
  })
  isDone?: string;

  @ApiProperty({
    description: 'Search term used',
    example: 'typescript',
    required: false,
  })
  search?: string;

  @ApiProperty({
    description: 'Filter from date',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    nullable: true,
  })
  dateFrom?: string | null;

  @ApiProperty({
    description: 'Filter to date',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
    nullable: true,
  })
  dateTo?: string | null;

  @ApiProperty({
    description: 'Sort by field',
    example: 'createdAt',
  })
  sortBy: string;

  @ApiProperty({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  sortOrder: 'asc' | 'desc';
}

/**
 * TodoPaginationResponseDto - DTO cho response pagination nâng cao
 */
export class TodoPaginationResponseDto {
  @ApiProperty({
    description: 'List of todos',
    type: [TodoResponseDto],
  })
  todos: TodoResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetaDto,
  })
  pagination: PaginationMetaDto;

  @ApiProperty({
    description: 'Filters metadata applied',
    type: FiltersMetaDto,
  })
  filters: FiltersMetaDto;
}
