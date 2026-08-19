import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { ApiBearerAuth } from '@nestjs/swagger';

/**
 * Auth Decorator - Decorator tổng hợp để bảo vệ endpoint với JWT + Roles
 *
 * Cách sử dụng:
 * @Auth() - Chỉ yêu cầu JWT authentication (không cần role cụ thể)
 * @Auth('admin') - Yêu cầu JWT + role admin
 * @Auth('admin', 'user') - Yêu cầu JWT + role admin hoặc user
 *
 * Decorator này kết hợp:
 * 1. ApiBearerAuth() - Swagger documentation cho Bearer token
 * 2. UseGuards(JwtAuthGuard, RolesGuard) - Bảo vệ endpoint với 2 guards
 * 3. Roles(...roles) - Chỉ định roles được phép (nếu có)
 * 4. Dấu ... - Dấu ba chấm cho phép truyền vào nhiều phần tử riêng lẻ
 */
export function Auth(...roles: UserRole[]) {
  // Khởi tạo mảng decorators cơ bản với type safety
  // ApiBearerAuth() - Thêm Bearer token vào Swagger docs
  // UseGuards(JwtAuthGuard, RolesGuard) - Áp dụng 2 guards theo thứ tự
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    ApiBearerAuth('JWT-auth'),
    UseGuards(JwtAuthGuard, RolesGuard),
  ];

  // Nếu có truyền roles vào decorator thì thêm Roles decorator
  // Ví dụ: @Auth('admin') sẽ thêm @Roles('admin')
  if (roles && roles.length > 0) {
    decorators.push(Roles(...roles));
  }

  // applyDecorators - Kết hợp tất cả decorators thành một decorator duy nhất
  // Đây là cách NestJS cho phép tạo composite decorators
  return applyDecorators(...decorators);
}
