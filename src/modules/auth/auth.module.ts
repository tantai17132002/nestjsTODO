import { Module } from '@nestjs/common';
import { AuthController } from '@/modules/auth/auth.controller';
import { UserModule } from '@/modules/users/users.module';
import { AuthService } from '@/modules/auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { CustomLogger } from '@/common/logger/custom-logger.service';

/**
 * AuthModule - Module quản lý authentication và authorization
 *
 * Module này tổ chức và kết nối các thành phần:
 * - AuthController: Xử lý HTTP requests cho auth (register, login, me)
 * - AuthService: Business logic cho authentication (validate user, tạo JWT)
 * - UserModule: Import để sử dụng UserService cho việc tạo và tìm user
 * - JwtModule: Cung cấp JWT service để tạo và verify token
 * - JwtStrategy: Strategy cho Passport để xác thực JWT token
 *
 * @description
 * Đây là một feature module chuyên về authentication
 * Có thể mở rộng thêm OAuth, Google Auth, Facebook Auth, etc.
 */
@Module({
  imports: [
    // Import UserModule để sử dụng UserService
    // UserModule đã export UserService nên có thể inject vào AuthService
    UserModule,

    // Cấu hình JWT Module với async factory
    // Sử dụng ConfigService để lấy JWT_SECRET từ environment variables
    JwtModule.registerAsync({
      imports: [ConfigModule], // Import ConfigModule để sử dụng ConfigService
      inject: [ConfigService], // Inject ConfigService vào factory function
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ||
            '1d') as `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],

  // Khai báo các controller xử lý HTTP requests cho auth
  // AuthController sẽ xử lý các endpoint:
  // - POST /auth/register: Đăng ký user mới
  // - POST /auth/login: Đăng nhập và nhận JWT token
  // - GET /auth/me: Lấy thông tin user hiện tại (cần JWT)
  controllers: [AuthController],

  // Khai báo các service và strategy chứa business logic
  // - AuthService: Logic đăng nhập, validate user, tạo JWT token
  // - JwtStrategy: Strategy cho Passport để xác thực JWT token
  // - CustomLogger: Trình ghi nhật ký tùy chỉnh cho nhật ký xác thực
  providers: [AuthService, JwtStrategy, CustomLogger],

  // Export AuthService để các module khác có thể sử dụng
  // Ví dụ: UserModule có thể cần AuthService để check password
  exports: [AuthService],
})
export class AuthModule {}
