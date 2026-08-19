import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload, JwtUser } from '@/common/types';
import { UserService } from '@/modules/users/users.service';

/**
 * Xác minh JWT rồi đọc lại user từ database để role mới có hiệu lực ngay.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Ánh xạ `sub` thành `id` và lấy role hiện tại từ DB, không tin role cũ trong token.
   *
   * @param payload Claims đã verify.
   * @returns JwtUser gắn vào request.
   * @throws UnauthorizedException nếu user không còn tồn tại.
   */
  async validate(payload: JwtPayload): Promise<JwtUser> {
    try {
      const user = await this.userService.findEntityById(payload.sub);
      return {
        id: user.id,
        username: user.username,
        role: user.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}
