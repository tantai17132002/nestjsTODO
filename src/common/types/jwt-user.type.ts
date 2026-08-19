import type { UserRole } from '@/common/constants/roles.constant';

/**
 * JwtUser - Interface cho thông tin user từ JWT token
 *
 * Interface này định nghĩa cấu trúc dữ liệu user được lưu trong JWT token
 * và được sử dụng trong các guards để kiểm tra quyền truy cập
 */
export interface JwtUser {
  /** ID duy nhất của user */
  id: number;

  /** Vai trò của user trong hệ thống */
  role: UserRole;

  /** Tên đăng nhập */
  username: string;

  /** Email của user (có thể không có trong một số trường hợp) */
  email?: string;

  /** Thời gian token được tạo (timestamp) */
  iat?: number;

  /** Thời gian token hết hạn (timestamp) */
  exp?: number;
}

/**
 * JwtPayload - Interface cho payload của JWT token
 *
 * Được sử dụng khi tạo JWT token trong auth service
 */
export interface JwtPayload {
  /** ID duy nhất của user */
  sub: number;

  /** Username của user */
  username: string;

  /** Vai trò của user */
  role: UserRole;
}
