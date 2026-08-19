import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO cho response xóa cứng todo.
 */
export class DeletedResponseDto {
  @ApiProperty({
    description: 'Xác nhận tài nguyên đã bị xóa',
    example: true,
  })
  deleted: boolean;
}
