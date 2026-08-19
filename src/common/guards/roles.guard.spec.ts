import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ROLES_KEY, ADMIN_ROLE, USER_ROLE } from '@/common/constants/roles.constant';
import { JwtUser } from '@/common/types/jwt-user.type';

/**
 * Unit Tests cho RolesGuard
 *
 * Đây là loại test đơn vị (Unit Test) để kiểm tra:
 * - Logic authorization dựa trên vai trò (role-based access control)
 * - KHÔNG chạm database thật (sử dụng mock ExecutionContext, Reflector)
 * - Mock tất cả dependencies (Reflector, ExecutionContext)
 * - Test từng scenario riêng lẻ với các role khác nhau
 * - Kiểm tra error handling và exception throwing
 *
 * Mục tiêu:
 * - user role không đúng → throw ForbiddenException (403)
 * - user role đúng → return true (pass)
 * - admin có thể access role user (role hierarchy)
 * - không có @Roles decorator → pass qua
 */
describe('RolesGuard', () => {
  let guard: RolesGuard; // Guard cần test
  let reflector: jest.Mocked<Reflector>; // Mock Reflector

  // ===== MOCK DATA (Dữ liệu giả lập) =====
  // Tạo mock users với các roles khác nhau
  const mockAdminUser: JwtUser = {
    id: 1,
    username: 'admin',
    email: 'admin@test.com',
    role: ADMIN_ROLE, // Admin user
  };

  const mockRegularUser: JwtUser = {
    id: 2,
    username: 'user',
    email: 'user@test.com',
    role: USER_ROLE, // Regular user
  };

  // ===== SETUP TEST MODULE (Thiết lập module test) =====
  beforeEach(async () => {
    // Tạo test module với mocked dependencies
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard, // Guard thật (không mock) để test logic
        {
          // Mock Reflector để kiểm soát metadata từ @Roles decorator
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(), // Mock method để lấy required roles
          },
        },
      ],
    }).compile();

    // Lấy instances để test
    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
  });

  // Dọn dẹp mocks sau mỗi test để tránh ảnh hưởng lẫn nhau
  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===== HELPER FUNCTION (Hàm hỗ trợ) =====
  /**
   * Tạo mock ExecutionContext cho testing
   * ExecutionContext chứa thông tin về request hiện tại
   */
  const createMockExecutionContext = (
    user: JwtUser | null = null,
  ): jest.Mocked<ExecutionContext> => {
    const mockRequest = {
      user, // Mock user trong request
      params: {}, // Mock URL parameters
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest), // Mock request object
      }),
      getHandler: jest.fn(), // Mock method handler
      getClass: jest.fn(), // Mock controller class
    } as any;
  };

  // ===== TEST CASES =====

  describe('canActivate', () => {
    // ===== TEST: Không có @Roles decorator =====
    it('should allow access when no roles are required', () => {
      // Arrange - Chuẩn bị scenario: endpoint không yêu cầu role cụ thể
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue(null); // Không có @Roles decorator

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify cho phép truy cập vì không yêu cầu role
      expect(result).toBe(true); // Pass qua
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should allow access when required roles array is empty', () => {
      // Arrange - Chuẩn bị scenario: @Roles([]) - array rỗng
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([]); // Array roles rỗng

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify cho phép truy cập vì không yêu cầu role cụ thể
      expect(result).toBe(true); // Pass qua
    });

    // ===== TEST: User authentication =====
    it('should throw ForbiddenException when user is not authenticated', () => {
      // Arrange - Chuẩn bị scenario: endpoint yêu cầu role nhưng user không được xác thực
      const mockContext = createMockExecutionContext(null); // Không có user
      reflector.getAllAndOverride.mockReturnValue([USER_ROLE]); // Yêu cầu user role

      // Act & Assert - Verify ném ForbiddenException
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('User not authenticated');
    });

    // ===== TEST: Role-based access control =====
    it('should allow access when user has exact required role', () => {
      // Arrange - Chuẩn bị scenario: user có đúng role được yêu cầu
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([USER_ROLE]); // Yêu cầu user role

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify cho phép truy cập vì user có đúng role
      expect(result).toBe(true); // Pass
    });

    it('should allow admin access to user-only endpoints (role hierarchy)', () => {
      // Arrange - Chuẩn bị scenario: admin truy cập endpoint chỉ cần user role
      const mockContext = createMockExecutionContext(mockAdminUser);
      reflector.getAllAndOverride.mockReturnValue([USER_ROLE]); // Yêu cầu user role

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify admin có thể truy cập (role hierarchy: admin >= user)
      expect(result).toBe(true); // Pass vì admin có quyền cao hơn
    });

    it('should deny access when user role is insufficient', () => {
      // Arrange - Chuẩn bị scenario: user thường truy cập endpoint chỉ dành cho admin
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([ADMIN_ROLE]); // Yêu cầu admin role

      // Act & Assert - Verify ném ForbiddenException
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access denied. Required roles: admin');
    });

    it('should allow access when user has one of multiple required roles', () => {
      // Arrange - Chuẩn bị scenario: endpoint cho phép nhiều roles, user có 1 trong số đó
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([ADMIN_ROLE, USER_ROLE]); // Yêu cầu admin HOẶC user

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify cho phép truy cập vì user có 1 trong các role được yêu cầu
      expect(result).toBe(true); // Pass
    });

    it('should deny access when user has none of the required roles', () => {
      // Arrange - Chuẩn bị scenario: user không có bất kỳ role nào được yêu cầu
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([ADMIN_ROLE]); // Chỉ yêu cầu admin

      // Act & Assert - Verify ném ForbiddenException
      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('Access denied. Required roles: admin');
    });

    // ===== TEST: Multiple roles scenarios =====
    it('should handle multiple required roles correctly', () => {
      // Arrange - Chuẩn bị scenario: endpoint yêu cầu nhiều roles
      const mockContext = createMockExecutionContext(mockAdminUser);
      reflector.getAllAndOverride.mockReturnValue([ADMIN_ROLE, USER_ROLE]); // Admin hoặc user

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify admin có thể truy cập
      expect(result).toBe(true); // Pass vì admin có trong danh sách
    });

    // ===== TEST: Edge cases =====
    it('should work with single role in array', () => {
      // Arrange - Chuẩn bị scenario: chỉ có 1 role trong array
      const mockContext = createMockExecutionContext(mockAdminUser);
      reflector.getAllAndOverride.mockReturnValue([ADMIN_ROLE]); // Chỉ admin

      // Act - Kiểm tra quyền truy cập
      const result = guard.canActivate(mockContext);

      // Assert - Verify admin có thể truy cập
      expect(result).toBe(true); // Pass
    });

    it('should properly call reflector with correct parameters', () => {
      // Arrange - Chuẩn bị để test reflector được gọi đúng
      const mockContext = createMockExecutionContext(mockRegularUser);
      reflector.getAllAndOverride.mockReturnValue([USER_ROLE]);

      // Act - Kiểm tra quyền truy cập
      guard.canActivate(mockContext);

      // Assert - Verify reflector được gọi với parameters đúng
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        ROLES_KEY, // Key để tìm metadata
        [mockContext.getHandler(), mockContext.getClass()], // Method và class handlers
      );
      expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1); // Chỉ gọi 1 lần
    });
  });
});
