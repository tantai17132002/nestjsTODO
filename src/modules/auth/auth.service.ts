import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '@/modules/users/users.service';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import { RegisterResponseDto, LoginResponseDto } from '@/modules/auth/dto/auth-response.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { CustomLogger } from '@/common/logger/custom-logger.service';
import { normalizeEmail } from '@/common/utils/normalize';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

/**
 * Xác thực đăng ký/đăng nhập và phát hành JWT; không tiết lộ user có tồn tại hay không.
 */
@Injectable()
export class AuthService {
  constructor(
    private usersService: UserService,
    private jwtService: JwtService,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * So khớp username/email và mật khẩu. Mọi thất bại trả cùng một thông báo 401.
   *
   * @param usernameOrEmail Username hoặc email đã trim.
   * @param password Mật khẩu plaintext.
   * @returns User entity nếu hợp lệ.
   * @throws UnauthorizedException với thông báo chung.
   */
  async validateUser(usernameOrEmail: string, password: string): Promise<UsersEntity> {
    const identifier = usernameOrEmail.includes('@')
      ? normalizeEmail(usernameOrEmail)
      : usernameOrEmail.trim();

    this.logger.debug?.(`Validating user: ${identifier}`);

    const user = await this.usersService.findByUsernameOrEmail(identifier);
    if (!user) {
      this.logger.warn(`Login failed for identifier: ${identifier}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      this.logger.warn(`Login failed for identifier: ${identifier}`);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    this.logger.log(`User validated successfully: ${user.username} (ID: ${user.id})`);
    return user;
  }

  /**
   * Ký JWT với payload `sub`, `username`, `role`. Thời hạn lấy từ cấu hình JwtModule.
   *
   * @param user User đã xác thực.
   * @returns `{ access_token }`.
   */
  login(user: UsersEntity): LoginResponseDto {
    this.logger.debug?.(`Creating JWT token for user: ${user.username} (ID: ${user.id})`);

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const token = this.jwtService.sign(payload);

    this.logger.log(`JWT token created successfully for user: ${user.username} (ID: ${user.id})`);
    return { access_token: token };
  }

  /**
   * Luồng đăng nhập: validate rồi phát hành token.
   *
   * @param loginDto usernameOrEmail và password.
   * @returns JWT access token.
   */
  async processLogin(loginDto: LoginDto): Promise<LoginResponseDto> {
    this.logger.log(`Processing login request for: ${loginDto.usernameOrEmail}`);
    const user = await this.validateUser(loginDto.usernameOrEmail, loginDto.password);
    return this.login(user);
  }

  /**
   * Đăng ký user mới với role `user`.
   *
   * @param createUserDto username, email, password.
   * @returns Thông báo thành công và user công khai.
   */
  async register(createUserDto: CreateUsersDto): Promise<RegisterResponseDto> {
    this.logger.log(`Processing registration request for user: ${createUserDto.username}`);
    const user = await this.usersService.createUser(createUserDto);
    this.logger.log(`User registered successfully: ${user.username} (ID: ${user.id})`);
    return {
      message: 'User registered successfully',
      user,
    };
  }
}
