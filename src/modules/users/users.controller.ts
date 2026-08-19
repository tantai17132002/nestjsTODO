import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UserService } from '@/modules/users/users.service';
import { Auth } from '@/common/decorators/auth.decorator';
import { SelfOrAdminGuard } from '@/common/guards/self-or-admin.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { UpdateRoleDto } from '@/modules/users/dto/update-role.dto';
import { QueryUserDto } from '@/modules/users/dto/query-user.dto';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { UserPaginationResponseDto } from '@/modules/users/dto/user-pagination-response.dto';
import {
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
  ForbiddenErrorResponseDto,
  NotFoundErrorResponseDto,
} from '@/common/dto/error-response.dto';

/**
 * UserController - Controller xử lý các request liên quan đến user
 *
 * Controller này chỉ chịu trách nhiệm:
 * - Routing: Định tuyến HTTP requests đến đúng endpoints
 * - Input/Output: Nhận request và trả về response
 * - Validation: Validate input thông qua DTOs và ValidationPipe
 * - Authentication: JWT authentication thông qua Guards
 * - Authorization: Role-based và Self-or-Admin authorization
 * - Gọi Service: Delegate business logic cho UserService
 *
 * Business logic và logging được xử lý trong UserService
 *
 * Endpoints:
 * - GET /users: Lấy danh sách users với pagination (Admin only)
 * - GET /users/:id: Lấy thông tin user theo ID
 * - PATCH /users/:id/role: Cập nhật role của user (Admin only)
 *
 * Các endpoint được bảo vệ bởi:
 * - JWT Authentication (thông qua @Auth decorator)
 * - Role-based Authorization (admin/user)
 * - Self-or-Admin Authorization (chỉ admin hoặc chính chủ mới truy cập được)
 *
 * @description
 * Tuân thủ nguyên tắc: Controller chỉ routing + I/O, Service xử lý business logic
 */
@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users - Lấy danh sách users với pagination
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate query parameters (thông qua DTOs và ValidationPipe)
   * - Authorization: Chỉ admin mới có quyền truy cập
   * - Gọi UserService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong UserService.findAll()
   *
   * Authorization:
   * - Chỉ ADMIN mới có quyền truy cập endpoint này
   * - Hỗ trợ pagination để tối ưu performance khi có nhiều users
   *
   * @param query - Query parameters với pagination (page, limit)
   * @returns Promise<Object> - Danh sách users và metadata pagination
   *
   * @example
   * GET /users?page=1&limit=10
   */
  @ApiOperation({
    summary: 'Get all users with pagination (Admin only)',
    description: 'Retrieve users with pagination support. Only admins can access this endpoint.',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (min: 1)',
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (min: 1, max: 100)',
    example: 10,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully with pagination',
    type: UserPaginationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid query parameters',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    type: ForbiddenErrorResponseDto,
  })
  @Auth('admin') // Chỉ admin mới có quyền xem danh sách toàn bộ user
  @Get()
  findAll(@Query() query: QueryUserDto) {
    return this.userService.findAll(query);
  }

  /**
   * GET /users/:id - Lấy thông tin một user cụ thể
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate path parameter (thông qua ParseIntPipe)
   * - Authorization: Self-or-Admin access control
   * - Gọi UserService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong UserService.findById()
   *
   * Authorization:
   * - ADMIN: có thể xem thông tin bất kỳ user nào
   * - USER: chỉ có thể xem thông tin của chính mình
   *
   * @param id - ID của user cần xem (từ URL params)
   * @returns Promise<UsersEntity> - Thông tin user
   */
  @ApiOperation({ summary: 'Get user by ID (Self or Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: NotFoundErrorResponseDto,
  })
  @Auth() // Cần JWT authentication trước
  @UseGuards(RolesGuard, SelfOrAdminGuard) // Sau đó kiểm tra role và self-or-admin
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // ParseIntPipe - Tự động chuyển đổi string thành number và validate
    return this.userService.findById(id);
  }

  /**
   * PATCH /users/:id/role - Cập nhật role của user
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate path parameter và body (thông qua ParseIntPipe và DTOs)
   * - Authorization: Chỉ admin mới có quyền thay đổi role
   * - Gọi UserService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong UserService.updateRole()
   *
   * Authorization:
   * - Chỉ ADMIN mới có quyền thay đổi role của user khác
   *
   * @param id - ID của user cần thay đổi role
   * @param dto - DTO chứa role mới (UpdateRoleDto)
   * @returns Promise<UsersEntity> - User đã được cập nhật role
   *
   * @example
   * PATCH /users/123/role
   * Body: { "role": "admin" }
   */
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  @ApiParam({ name: 'id', description: 'User ID', example: 1 })
  @ApiBody({ type: UpdateRoleDto })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid role',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    type: NotFoundErrorResponseDto,
  })
  @Auth('admin') // Chỉ admin mới có quyền đổi role user
  @Patch(':id/role')
  updateRole(
    @Param('id', ParseIntPipe) id: number, // ID từ URL params
    @Body() dto: UpdateRoleDto, // Role mới từ request body
  ) {
    return this.userService.updateRole(id, dto);
  }
}
