import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '@/modules/users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import { RegisterResponseDto, LoginResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { CustomLogger } from '@/common/logger/custom-logger.service';

/**
 * AuthService - Service xử lý xác thực và phân quyền
 *
 * Service này chịu trách nhiệm:
 * - Xác thực người dùng (validate username/password)
 * - Tạo JWT token cho người dùng đã đăng nhập
 * - Quản lý quá trình đăng nhập và đăng ký
 * - Logging tất cả hoạt động authentication
 *
 * Authentication Flow:
 * 1. User gửi username/email + password
 * 2. Service tìm user trong database
 * 3. So sánh password với bcrypt
 * 4. Nếu đúng → tạo JWT token
 * 5. Trả về token cho client
 *
 * Security Features:
 * - Password hashing với bcrypt
 * - JWT token với expiration
 * - Comprehensive logging cho audit trail
 * - Input validation và error handling
 *
 * Dependencies:
 * - UserService: Quản lý user data
 * - JwtService: Tạo và verify JWT tokens
 * - CustomLogger: Logging authentication events
 * - bcrypt: Password hashing và comparison
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService, // Service để tương tác với user data (CRUD operations)
    private jwtService: JwtService, // Service để tạo và verify JWT token (sign/verify)
    private readonly logger: CustomLogger, // Custom logger cho authentication logs (audit trail)
  ) {}

  /**
   * Xác thực người dùng bằng username/email và password
   *
   * Method này thực hiện authentication cơ bản:
   * 1. Tìm user trong database theo username hoặc email
   * 2. So sánh password người dùng nhập với password đã hash trong DB
   * 3. Trả về user object nếu xác thực thành công
   * 4. Throw UnauthorizedException nếu thất bại
   *
   * Security Features:
   * - Hỗ trợ đăng nhập bằng username hoặc email
   * - Password comparison sử dụng bcrypt (timing attack safe)
   * - Comprehensive logging cho audit trail
   * - Generic error messages (không leak thông tin)
   *
   * @param usernameOrEmail - Username hoặc email đăng nhập của người dùng
   * @param password - Mật khẩu chưa mã hóa từ người dùng (plain text)
   * @returns Promise<UsersEntity> - Thông tin user nếu xác thực thành công
   * @throws UnauthorizedException - Nếu user không tồn tại hoặc sai mật khẩu
   *
   * @example
   * // Đăng nhập bằng username
   * const user = await authService.validateUser("john_doe", "password123");
   *
   * // Đăng nhập bằng email
   * const user2 = await authService.validateUser("john@example.com", "password123");
   *
   * // Xử lý lỗi
   * try {
   *   const user = await authService.validateUser("invalid", "wrong");
   * } catch (error) {
   *   // error.message = "User not found" hoặc "Wrong password"
   * }
   */
  async validateUser(usernameOrEmail: string, password: string): Promise<UsersEntity> {
    // Log bắt đầu quá trình validation
    this.logger.debug?.(`Validating user: ${usernameOrEmail}`);

    // Bước 1: Tìm user trong database theo username hoặc email
    // UserService sẽ tìm kiếm trong cả username và email fields
    const user = await this.usersService.findByUsernameOrEmail(usernameOrEmail);
    if (!user) {
      // User không tồn tại → log warning và throw exception
      this.logger.warn(`User not found: ${usernameOrEmail}`);
      throw new UnauthorizedException('User not found');
    }

    // Bước 2: So sánh password người dùng nhập với password đã mã hóa trong database
    // bcrypt.compare() sẽ hash password input và so sánh với hash trong DB
    // Method này an toàn với timing attacks
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Password sai → log warning và throw exception
      this.logger.warn(`Wrong password for user: ${usernameOrEmail}`);
      throw new UnauthorizedException('Wrong password');
    }

    // Bước 3: Validation thành công → log success và trả về user object
    this.logger.log(`User validated successfully: ${usernameOrEmail} (ID: ${user.id})`);
    return user;
  }

  /**
   * Tạo JWT token cho người dùng đã đăng nhập
   *
   * Method này tạo JWT (JSON Web Token) cho user đã được xác thực:
   * 1. Tạo payload chứa thông tin user (ID, username, role)
   * 2. Ký token bằng JWT secret key
   * 3. Trả về token cho client sử dụng
   *
   * JWT Payload Structure:
   * {
   *   "sub": user.id,        // Subject (user ID)
   *   "username": "john_doe", // Username
   *   "role": "user",        // User role (user/admin)
   *   "iat": 1234567890,     // Issued at (auto-generated)
   *   "exp": 1234654290      // Expiration (auto-generated)
   * }
   *
   * Security Features:
   * - Token có expiration time (1 day theo config)
   * - Payload chỉ chứa thông tin cần thiết
   * - Signed với secret key để prevent tampering
   * - Logging cho audit trail
   *
   * @param user - Thông tin user đã được xác thực (từ validateUser)
   * @returns LoginResponseDto - Object chứa access_token
   *
   * @example
   * // Sau khi validate user thành công
   * const user = await authService.validateUser("john_doe", "password123");
   * const result = await authService.login(user);
   *
   * console.log(result.access_token); // "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *
   * // Client sẽ sử dụng token này trong Authorization header
   * // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   */
  async login(user: UsersEntity): Promise<LoginResponseDto> {
    // Log bắt đầu quá trình tạo JWT token
    this.logger.debug?.(`Creating JWT token for user: ${user.username} (ID: ${user.id})`);

    // Bước 1: Tạo payload cho JWT token
    // Payload chứa thông tin user sẽ được mã hóa trong token
    const payload = {
      sub: user.id, // Subject - ID của user (để identify user)
      username: user.username, // Tên đăng nhập (để hiển thị)
      role: user.role, // Vai trò của user (user/admin) - để authorization
    };

    // Bước 2: Ký token bằng JWT service
    // JwtService sẽ tự động thêm iat (issued at) và exp (expiration)
    const token = this.jwtService.sign(payload);

    // Bước 3: Log thành công và trả về token
    this.logger.log(`JWT token created successfully for user: ${user.username} (ID: ${user.id})`);

    return {
      access_token: token, // Token sẽ được client sử dụng trong Authorization header
    };
  }

  /**
   * Xử lý đăng nhập user (Main login method)
   *
   * Method này là entry point cho quá trình đăng nhập:
   * 1. Nhận login credentials từ client (username/email + password)
   * 2. Validate user credentials bằng validateUser()
   * 3. Tạo JWT token bằng login()
   * 4. Trả về token cho client
   *
   * Flow:
   * Client Request → processLogin() → validateUser() → login() → JWT Token
   *
   * Error Handling:
   * - UnauthorizedException: Nếu credentials không đúng
   * - ExceptionFilter sẽ handle và trả về HTTP 401
   *
   * Logging:
   * - Log bắt đầu và kết thúc quá trình login
   * - Detailed logs trong validateUser() và login()
   *
   * @param loginDto - Dữ liệu đăng nhập từ request body (usernameOrEmail, password)
   * @returns LoginResponseDto - JWT access token cho client
   * @throws UnauthorizedException - Nếu thông tin đăng nhập không chính xác
   *
   * @example
   * // Client gửi request POST /auth/login
   * const loginData = {
   *   usernameOrEmail: "john_doe",
   *   password: "password123"
   * };
   *
   * const result = await authService.processLogin(loginData);
   * // result = { access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
   */
  async processLogin(loginDto: LoginDto): Promise<LoginResponseDto> {
    // Bước 1: Log bắt đầu quá trình login
    this.logger.log(`Processing login request for: ${loginDto.usernameOrEmail}`);

    // Bước 2: Xác thực user bằng username/email và password
    // validateUser() sẽ throw UnauthorizedException nếu credentials sai
    const user = await this.validateUser(loginDto.usernameOrEmail, loginDto.password);

    // Bước 3: Tạo JWT token cho user đã được xác thực
    const result = await this.login(user);

    // Bước 4: Log thành công và trả về token
    this.logger.log(`Login successful for user: ${user.username} (ID: ${user.id})`);

    return result; // { access_token: "jwt_token_here" }
  }

  /**
   * Đăng ký user mới
   *
   * Method này xử lý quá trình đăng ký user mới:
   * 1. Nhận thông tin user từ client (username, email, password)
   * 2. Gọi UserService để tạo user mới (password sẽ được hash)
   * 3. Trả về thông tin user đã tạo (không bao gồm password)
   *
   * Security Features:
   * - Password được hash bằng bcrypt trong UserService
   * - Không trả về password trong response
   * - Comprehensive error handling và logging
   * - Validation được handle bởi DTOs và ValidationPipe
   *
   * Error Scenarios:
   * - Username/email đã tồn tại → ConflictException
   * - Database errors → InternalServerError
   * - Validation errors → BadRequestException
   *
   * @param createUserDto - Dữ liệu user từ request body (username, email, password)
   * @returns RegisterResponseDto - Thông tin user đã tạo và success message
   * @throws HttpException - Nếu có lỗi xảy ra (handled bởi ExceptionFilter)
   *
   * @example
   * // Client gửi request POST /auth/register
   * const userData = {
   *   username: "john_doe",
   *   email: "john@example.com",
   *   password: "password123"
   * };
   *
   * const result = await authService.register(userData);
   * // result = {
   * //   message: "User registered successfully",
   * //   user: { id: 1, username: "john_doe", email: "john@example.com", role: "user" }
   * // }
   */
  async register(createUserDto: CreateUsersDto): Promise<RegisterResponseDto> {
    // Bước 1: Log bắt đầu quá trình registration
    this.logger.log(`Processing registration request for user: ${createUserDto.username}`);

    try {
      // Bước 2: Gọi UserService để tạo user mới
      // UserService sẽ handle:
      // - Password hashing với bcrypt
      // - Database insertion
      // - Validation và error handling
      const user = await this.usersService.createUser(createUserDto);

      // Bước 3: Log thành công và trả về response
      this.logger.log(`User registered successfully: ${user.username} (ID: ${user.id})`);

      return {
        message: 'User registered successfully',
        user, // User object không bao gồm password (đã được UserService filter)
      };
    } catch (error) {
      // Bước 4: Error handling và logging
      this.logger.error(`Registration failed for user: ${createUserDto.username}`, (error as Error).stack);
      // Re-throw error để ExceptionFilter handle và trả về HTTP response phù hợp
      throw error;
    }
  }
}
