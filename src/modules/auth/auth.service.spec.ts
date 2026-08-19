import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/users/users.service';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { CustomLogger } from '@/common/logger/custom-logger.service';

// Mock bcrypt để tránh gọi hàm hash thật
jest.mock('bcryptjs');

/**
 * Unit Tests cho AuthService
 *
 * Mục tiêu:
 * - Test logic xác thực và phân quyền
 * - Mock hoàn toàn UserService và JwtService để không chạm DB thật
 * - Test nhanh, chạy nhiều lần an toàn
 * - Tập trung vào business logic authentication
 */
describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;

  // Mock data cho tests - dữ liệu giả để test
  const mockUser: UsersEntity = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword123',
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
    todos: Promise.resolve([]),
  } as UsersEntity;

  // DTO cho việc tạo user mới
  const mockCreateUserDto: CreateUsersDto = {
    username: 'newuser',
    email: 'new@example.com',
    password: 'password123',
  };

  // DTO cho việc đăng nhập
  const mockLoginDto: LoginDto = {
    usernameOrEmail: 'testuser',
    password: 'password123',
  };

  beforeEach(async () => {
    // Thiết lập module test với các mock services
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            findByUsernameOrEmail: jest.fn(),
            createUser: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: CustomLogger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    // Xóa tất cả mock sau mỗi test để tránh ảnh hưởng lẫn nhau
    jest.clearAllMocks();
  });

  /**
   * Test validateUser method - Xác thực người dùng
   * Method này kiểm tra username/email và password có đúng không
   */
  describe('validateUser', () => {
    it('should validate user successfully with correct credentials', async () => {
      // Arrange - Chuẩn bị dữ liệu test
      const usernameOrEmail = 'testuser';
      const password = 'password123';
      const hashedPassword = 'hashedPassword123';

      // Mock UserService trả về user và bcrypt.compare trả về true
      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act - Thực hiện method cần test
      const result = await service.validateUser(usernameOrEmail, password);

      // Assert - Kiểm tra kết quả
      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(usernameOrEmail);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toEqual({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // Arrange - User không tồn tại trong database
      const usernameOrEmail = 'nonexistent';
      const password = 'password123';

      userService.findByUsernameOrEmail.mockResolvedValue(null);

      // Act & Assert - Kiểm tra exception được throw
      await expect(service.validateUser(usernameOrEmail, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(usernameOrEmail, password)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(usernameOrEmail);
      expect(bcrypt.compare).not.toHaveBeenCalled(); // Không gọi bcrypt vì user không tồn tại
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      // Arrange - User tồn tại nhưng password sai
      const usernameOrEmail = 'testuser';
      const password = 'wrongpassword';
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert - Kiểm tra exception khi password sai
      await expect(service.validateUser(usernameOrEmail, password)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateUser(usernameOrEmail, password)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(usernameOrEmail);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should validate user with email instead of username', async () => {
      // Arrange - Test đăng nhập bằng email thay vì username
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act - Thực hiện validate với email
      const result = await service.validateUser(email, password);

      // Assert - Kiểm tra kết quả
      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(email);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toEqual({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
    });
  });

  /**
   * Test login method - Tạo JWT token
   * Method này tạo JWT token cho user đã được xác thực
   */
  describe('login', () => {
    it('should generate JWT token successfully', async () => {
      // Arrange - Chuẩn bị mock JWT token
      const mockToken = 'mock.jwt.token';
      const expectedPayload = {
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      };

      jwtService.sign.mockReturnValue(mockToken);

      // Act - Tạo JWT token
      const result = service.login(mockUser);

      // Assert - Kiểm tra JWT được tạo với payload đúng
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual({
        access_token: mockToken,
      });
    });

    it('should generate JWT token for admin user', async () => {
      // Arrange - Test với admin user
      const adminUser = { ...mockUser, role: 'admin' as const };
      const mockToken = 'admin.jwt.token';
      const expectedPayload = {
        sub: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
      };

      jwtService.sign.mockReturnValue(mockToken);

      // Act - Tạo JWT cho admin
      const result = service.login(adminUser);

      // Assert - Kiểm tra payload chứa role admin
      expect(jwtService.sign).toHaveBeenCalledWith(expectedPayload);
      expect(result).toEqual({
        access_token: mockToken,
      });
    });

    it('should include correct payload structure in JWT', async () => {
      // Arrange - Test với user tùy chỉnh
      const mockToken = 'mock.jwt.token';
      const customUser = {
        id: 999,
        username: 'customuser',
        email: 'custom@example.com',
        password: 'hashedPassword',
        role: 'user' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        todos: Promise.resolve([]),
      } as UsersEntity;

      jwtService.sign.mockReturnValue(mockToken);

      // Act - Tạo JWT với user tùy chỉnh
      service.login(customUser);

      // Assert - Kiểm tra payload structure đúng
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 999,
        username: 'customuser',
        role: 'user',
      });
    });
  });

  /**
   * Test processLogin method - Xử lý đăng nhập hoàn chỉnh
   * Method này kết hợp validateUser và login
   */
  describe('processLogin', () => {
    it('should process login successfully with valid credentials', async () => {
      // Arrange - Chuẩn bị cho quá trình đăng nhập hoàn chỉnh
      const mockToken = 'mock.jwt.token';
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue(mockToken);

      // Act - Thực hiện đăng nhập
      const result = await service.processLogin(mockLoginDto);

      // Assert - Kiểm tra toàn bộ flow đăng nhập
      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(mockLoginDto.usernameOrEmail);
      expect(bcrypt.compare).toHaveBeenCalledWith(mockLoginDto.password, hashedPassword);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      });
      expect(result).toEqual({
        access_token: mockToken,
      });
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      // Arrange - User không tồn tại
      userService.findByUsernameOrEmail.mockResolvedValue(null);

      // Act & Assert - Kiểm tra exception khi thông tin đăng nhập sai
      await expect(service.processLogin(mockLoginDto)).rejects.toThrow(UnauthorizedException);

      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(mockLoginDto.usernameOrEmail);
      expect(jwtService.sign).not.toHaveBeenCalled(); // Không tạo JWT khi đăng nhập thất bại
    });

    it('should process login with email instead of username', async () => {
      // Arrange - Test đăng nhập bằng email
      const loginWithEmail: LoginDto = {
        usernameOrEmail: 'test@example.com',
        password: 'password123',
      };
      const mockToken = 'mock.jwt.token';
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue(mockToken);

      // Act - Đăng nhập bằng email
      const result = await service.processLogin(loginWithEmail);

      // Assert - Kiểm tra kết quả
      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', hashedPassword);
      expect(result).toEqual({
        access_token: mockToken,
      });
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      // Arrange - Password sai
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert - Kiểm tra exception khi password sai
      await expect(service.processLogin(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      await expect(service.processLogin(mockLoginDto)).rejects.toThrow('Invalid credentials');

      expect(userService.findByUsernameOrEmail).toHaveBeenCalledWith(mockLoginDto.usernameOrEmail);
      expect(bcrypt.compare).toHaveBeenCalledWith(mockLoginDto.password, hashedPassword);
      expect(jwtService.sign).not.toHaveBeenCalled(); // Không tạo JWT khi password sai
    });
  });

  /**
   * Test register method - Đăng ký user mới
   * Method này tạo user mới trong hệ thống
   */
  describe('register', () => {
    it('should register user successfully', async () => {
      // Arrange - Chuẩn bị user mới được tạo
      const createdUser = { ...mockUser, id: 2, todos: Promise.resolve([]) };
      userService.createUser.mockResolvedValue(createdUser);

      // Act - Đăng ký user mới
      const result = await service.register(mockCreateUserDto);

      // Assert - Kiểm tra user được tạo thành công
      expect(userService.createUser).toHaveBeenCalledWith(mockCreateUserDto);
      expect(result).toEqual({
        message: 'User registered successfully',
        user: createdUser,
      });
    });

    it('should propagate errors from userService.createUser', async () => {
      // Arrange - Mock lỗi từ UserService
      const error = new Error('Username already exists');
      userService.createUser.mockRejectedValue(error);

      // Act & Assert - Kiểm tra lỗi được propagate lên
      await expect(service.register(mockCreateUserDto)).rejects.toThrow('Username already exists');

      expect(userService.createUser).toHaveBeenCalledWith(mockCreateUserDto);
    });

    it('should handle database constraint violations', async () => {
      // Arrange - Mock lỗi constraint từ database
      const constraintError = new Error('Duplicate entry for key username');
      userService.createUser.mockRejectedValue(constraintError);

      // Act & Assert - Kiểm tra xử lý lỗi database
      await expect(service.register(mockCreateUserDto)).rejects.toThrow(
        'Duplicate entry for key username',
      );

      expect(userService.createUser).toHaveBeenCalledWith(mockCreateUserDto);
    });

    it('should register admin user successfully', async () => {
      // Arrange - Test đăng ký admin user
      const adminUser = {
        ...mockUser,
        id: 3,
        role: 'admin' as const,
        todos: Promise.resolve([]),
      };
      userService.createUser.mockResolvedValue(adminUser);

      // Act - Đăng ký admin
      const result = await service.register(mockCreateUserDto);

      // Assert - Kiểm tra admin được tạo thành công
      expect(userService.createUser).toHaveBeenCalledWith(mockCreateUserDto);
      expect(result).toEqual({
        message: 'User registered successfully',
        user: adminUser,
      });
    });
  });

  /**
   * Test Integration scenarios - Các kịch bản tích hợp
   * Test các flow hoàn chỉnh từ đăng ký đến đăng nhập
   */
  describe('Integration scenarios', () => {
    it('should handle complete login flow with registration', async () => {
      // Arrange - Đăng ký user mới
      const newUser = { ...mockUser, id: 4, todos: Promise.resolve([]) };
      userService.createUser.mockResolvedValue(newUser);

      // Act - Đăng ký
      const registerResult = await service.register(mockCreateUserDto);

      // Assert - Kiểm tra đăng ký thành công
      expect(registerResult).toEqual({
        message: 'User registered successfully',
        user: newUser,
      });

      // Arrange - Đăng nhập với user vừa đăng ký
      const loginDto: LoginDto = {
        usernameOrEmail: mockCreateUserDto.username,
        password: mockCreateUserDto.password,
      };
      const mockToken = 'integration.jwt.token';
      const hashedPassword = 'hashedPassword123';

      userService.findByUsernameOrEmail.mockResolvedValue({
        ...newUser,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue(mockToken);

      // Act - Đăng nhập
      const loginResult = await service.processLogin(loginDto);

      // Assert - Kiểm tra đăng nhập thành công
      expect(loginResult).toEqual({
        access_token: mockToken,
      });
    });

    it('should handle multiple login attempts with different users', async () => {
      // Arrange - Chuẩn bị 2 user khác nhau
      const user1 = {
        ...mockUser,
        id: 1,
        username: 'user1',
        todos: Promise.resolve([]),
      };
      const user2 = {
        ...mockUser,
        id: 2,
        username: 'user2',
        todos: Promise.resolve([]),
      };
      const mockToken1 = 'token1';
      const mockToken2 = 'token2';
      const hashedPassword = 'hashedPassword123';

      // Act & Assert - Đăng nhập user1
      userService.findByUsernameOrEmail.mockResolvedValue({
        ...user1,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue(mockToken1);

      const result1 = await service.processLogin({
        usernameOrEmail: 'user1',
        password: 'password123',
      });

      expect(result1).toEqual({ access_token: mockToken1 });

      // Act & Assert - Đăng nhập user2
      userService.findByUsernameOrEmail.mockResolvedValue({
        ...user2,
        password: hashedPassword,
        todos: Promise.resolve([]),
      });
      jwtService.sign.mockReturnValue(mockToken2);

      const result2 = await service.processLogin({
        usernameOrEmail: 'user2',
        password: 'password123',
      });

      expect(result2).toEqual({ access_token: mockToken2 });
    });
  });
});
