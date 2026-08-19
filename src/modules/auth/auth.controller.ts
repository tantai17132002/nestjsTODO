// Import các decorator và module cần thiết từ NestJS
import { Body, Controller, Post, Get, UseGuards, HttpCode } from '@nestjs/common';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { AuthService } from '@/modules/auth/auth.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RegisterResponseDto, LoginResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { CurrentUserResponseDto } from '@/modules/auth/dto/current-user-response.dto';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
} from '@/common/dto/error-response.dto';
import type { JwtUser } from '@/common/types';

// import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
/**
 * AuthController - Controller xử lý các request liên quan đến authentication
 *
 * Controller này chỉ chịu trách nhiệm:
 * - Routing: Định tuyến HTTP requests đến đúng endpoints
 * - Input/Output: Nhận request và trả về response
 * - Validation: Validate input thông qua DTOs và ValidationPipe
 * - Authentication: JWT authentication thông qua Guards
 * - Gọi Service: Delegate business logic cho AuthService
 *
 * Business logic và logging được xử lý trong AuthService
 *
 * Endpoints:
 * - POST /auth/register: Đăng ký user mới
 * - POST /auth/login: Đăng nhập user
 * - GET /auth/me: Lấy thông tin user hiện tại
 *
 * @description
 * Sử dụng prefix 'auth' cho tất cả routes
 * Tuân thủ nguyên tắc: Controller chỉ routing + I/O, Service xử lý business logic
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint đăng ký user mới
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate input (thông qua DTOs và ValidationPipe)
   * - Gọi AuthService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong AuthService.register()
   *
   * @param createUserDto - Dữ liệu user từ request body (username, email, password)
   * @returns Object chứa message thành công và thông tin user đã tạo
   *
   * @example
   * // Request: POST /auth/register
   * // Body:
   * {
   *   "username": "john_doe",
   *   "email": "john@example.com",
   *   "password": "password123"
   * }
   *
   * // Response:
   * {
   *   "message": "User registered successfully",
   *   "user": {
   *     "id": 1,
   *     "username": "john_doe",
   *     "email": "john@example.com",
   *     "role": "user"
   *   }
   * }
   */
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({ type: CreateUsersDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Username or email already exists',
    type: ErrorResponseDto,
  })
  @Post('register')
  async register(@Body() createUserDto: CreateUsersDto) {
    // Controller chỉ routing và gọi service
    // Logging và business logic được xử lý trong AuthService
    return this.authService.register(createUserDto);
  }

  /**
   * Endpoint đăng nhập user
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate input (thông qua DTOs và ValidationPipe)
   * - Gọi AuthService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong AuthService.processLogin()
   *
   * @param dto - Dữ liệu đăng nhập từ request body (usernameOrEmail, password)
   * @returns Object chứa JWT access token
   *
   * @example
   * // Request: POST /auth/login
   * // Body (đăng nhập bằng username):
   * {
   *   "usernameOrEmail": "john_doe",
   *   "password": "password123"
   * }
   *
   * // Body (đăng nhập bằng email):
   * {
   *   "usernameOrEmail": "john@example.com",
   *   "password": "password123"
   * }
   *
   * // Response:
   * {
   *   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   * }
   */
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successfully',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Login failed',
    type: UnauthorizedErrorResponseDto,
  })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    // Controller chỉ routing và gọi service
    // Logging và business logic được xử lý trong AuthService
    return this.authService.processLogin(dto);
  }

  /**
   * Endpoint lấy thông tin user hiện tại (cần xác thực)
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client (với JWT token)
   * - JWT authentication (thông qua JwtAuthGuard)
   * - Trả về thông tin user từ JWT token
   *
   * Không cần gọi service vì thông tin user đã có trong JWT token
   *
   * @param user - Thông tin user từ JWT token (được inject bởi CurrentUser decorator)
   * @returns Thông tin user hiện tại
   *
   * @example
   * // Request: GET /auth/me
   * // Headers: Authorization: Bearer <jwt_token>
   *
   * // Response:
   * {
   *   "id": 1,
   *   "username": "john_doe",
   *   "role": "user"
   * }
   */
  @ApiOperation({ summary: 'Get current user information' })
  @ApiBearerAuth('JWT-auth')
  @ApiResponse({
    status: 200,
    description: 'Current user information from the authenticated session',
    type: CurrentUserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @UseGuards(JwtAuthGuard) // Bảo vệ endpoint bằng JWT authentication
  @Get('me')
  getMe(@CurrentUser() user: JwtUser): CurrentUserResponseDto {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }
}
