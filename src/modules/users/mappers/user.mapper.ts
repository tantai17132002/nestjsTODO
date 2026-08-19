import { UsersEntity } from '@/modules/users/entity/users.entity';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';

/**
 * Ánh xạ user entity sang DTO công khai, loại bỏ password/hash.
 *
 * @param user Entity user từ database.
 * @returns User đúng hợp đồng API.
 */
export function toPublicUser(user: UsersEntity): UserResponseDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
