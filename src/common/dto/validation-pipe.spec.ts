import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { CreateTodoDto } from '@/modules/todos/dto/create-todo.dto';
import { UpdateTodoDto } from '@/modules/todos/dto/update-todo.dto';
import { QueryTodoDto } from '@/modules/todos/dto/query-todo.dto';

/**
 * Unit Tests cho ValidationPipe + DTOs
 *
 * Đây là loại test đơn vị (Unit Test) để kiểm tra:
 * - Validation logic của các DTOs (Data Transfer Objects)
 * - KHÔNG chạm database thật (sử dụng plainToClass và validate)
 * - Test từng validation rule riêng lẻ
 * - Kiểm tra error handling và validation messages
 *
 * Mục tiêu:
 * - gửi thiếu field → 400 BadRequestException
 * - gửi đúng → pass validation
 * - gửi sai format → 400 BadRequestException
 *
 * DTOs được test:
 * - CreateUsersDto: username, email, password validation
 * - LoginDto: usernameOrEmail, password validation
 * - CreateTodoDto: title, description, isDone validation
 * - QueryTodoDto: pagination, filtering, sorting validation
 */
describe('ValidationPipe + DTOs', () => {
  // ===== TEST CreateUsersDto =====
  describe('CreateUsersDto', () => {
    it('should pass validation with valid data', async () => {
      // Arrange - Dữ liệu hợp lệ
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when username is missing', async () => {
      // Arrange - Thiếu field username
      const invalidData = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho username
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('username');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when email is missing', async () => {
      // Arrange - Thiếu field email
      const invalidData = {
        username: 'testuser',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho email
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation when email format is invalid', async () => {
      // Arrange - Email format không hợp lệ
      const invalidData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho email format
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation when password is missing', async () => {
      // Arrange - Thiếu field password
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho password
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      // Khi password undefined, MinLength sẽ được check trước IsNotEmpty
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation when password is too short', async () => {
      // Arrange - Password quá ngắn (dưới 8 ký tự)
      const invalidData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123', // Chỉ 3 ký tự
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho password length
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail validation when multiple fields are missing', async () => {
      // Arrange - Thiếu nhiều fields
      const invalidData = {
        username: 'testuser',
        // Thiếu email và password
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateUsersDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có nhiều lỗi validation
      expect(errors).toHaveLength(2);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });
  });

  // ===== TEST LoginDto =====
  describe('LoginDto', () => {
    it('should pass validation with valid data', async () => {
      // Arrange - Dữ liệu hợp lệ
      const validData = {
        usernameOrEmail: 'testuser',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(LoginDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with email format', async () => {
      // Arrange - Dữ liệu hợp lệ với email
      const validData = {
        usernameOrEmail: 'test@example.com',
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(LoginDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when usernameOrEmail is missing', async () => {
      // Arrange - Thiếu field usernameOrEmail
      const invalidData = {
        password: 'password123',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(LoginDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho usernameOrEmail
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('usernameOrEmail');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when password is missing', async () => {
      // Arrange - Thiếu field password
      const invalidData = {
        usernameOrEmail: 'testuser',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(LoginDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho password
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when password is too short', async () => {
      // Arrange - Password quá ngắn
      const invalidData = {
        usernameOrEmail: 'testuser',
        password: '123', // Chỉ 3 ký tự
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(LoginDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho password length
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });
  });

  // ===== TEST CreateTodoDto =====
  describe('CreateTodoDto', () => {
    it('should pass validation with required fields only', async () => {
      // Arrange - Chỉ có field bắt buộc
      const validData = {
        title: 'Test Todo',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields', async () => {
      // Arrange - Tất cả fields
      const validData = {
        title: 'Test Todo',
        description: 'Test Description',
        isDone: false,
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when title is missing', async () => {
      // Arrange - Thiếu field title (bắt buộc)
      const invalidData = {
        description: 'Test Description',
        isDone: false,
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho title
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when title is empty string', async () => {
      // Arrange - Title rỗng
      const invalidData = {
        title: '',
        description: 'Test Description',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho title
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when title is not string', async () => {
      // Arrange - Title không phải string
      const invalidData = {
        title: 123, // Number thay vì string
        description: 'Test Description',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho title type
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when description is not string', async () => {
      // Arrange - Description không phải string
      const invalidData = {
        title: 'Test Todo',
        description: 123, // Number thay vì string
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho description type
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail validation when isDone is not boolean', async () => {
      // Arrange - isDone không phải boolean
      const invalidData = {
        title: 'Test Todo',
        isDone: 'not-boolean', // String thay vì boolean
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho isDone type
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('isDone');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should pass validation when optional fields are undefined', async () => {
      // Arrange - Optional fields undefined
      const validData = {
        title: 'Test Todo',
        description: undefined,
        isDone: undefined,
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(CreateTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateTodoDto', () => {
    it('should pass validation with a non-empty title', async () => {
      const dto = plainToClass(UpdateTodoDto, { title: 'Updated title' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when title is empty string', async () => {
      const dto = plainToClass(UpdateTodoDto, { title: '   ' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });
  });

  // ===== TEST QueryTodoDto =====
  describe('QueryTodoDto', () => {
    it('should pass validation with no query parameters', async () => {
      // Arrange - Không có query parameters (sử dụng defaults)
      const validData = {};

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid pagination parameters', async () => {
      // Arrange - Pagination parameters hợp lệ
      const validData = {
        page: 1,
        limit: 10,
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid filtering parameters', async () => {
      // Arrange - Filtering parameters hợp lệ
      const validData = {
        isDone: 'true',
        search: 'typescript',
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.999Z',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid sorting parameters', async () => {
      // Arrange - Sorting parameters hợp lệ
      const validData = {
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });

    it('should fail validation when isDone is not boolean string', async () => {
      // Arrange - isDone không phải "true" hoặc "false"
      const invalidData = {
        isDone: 'maybe', // Không phải boolean string
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho isDone
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('isDone');
      expect(errors[0].constraints).toHaveProperty('isBooleanString');
    });

    it('should fail validation when dateFrom is not valid date string', async () => {
      // Arrange - dateFrom không phải date string hợp lệ
      const invalidData = {
        dateFrom: 'not-a-date',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho dateFrom
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('dateFrom');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });

    it('should fail validation when dateFrom is after dateTo', async () => {
      const invalidData = {
        dateFrom: '2024-12-31T00:00:00.000Z',
        dateTo: '2024-01-01T00:00:00.000Z',
      };

      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      expect(errors.some((e) => e.property === 'dateTo')).toBe(true);
    });

    it('should fail validation when dateTo is not valid date string', async () => {
      // Arrange - dateTo không phải date string hợp lệ
      const invalidData = {
        dateTo: 'invalid-date',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho dateTo
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('dateTo');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });

    it('should fail validation when sortBy is not in allowed values', async () => {
      // Arrange - sortBy không nằm trong danh sách cho phép
      const invalidData = {
        sortBy: 'invalidField',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho sortBy
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortBy');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation when sortOrder is not in allowed values', async () => {
      // Arrange - sortOrder không phải 'asc' hoặc 'desc'
      const invalidData = {
        sortOrder: 'invalid',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, invalidData);
      const errors = await validate(dto);

      // Assert - Có lỗi validation cho sortOrder
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortOrder');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should pass validation with all parameters combined', async () => {
      // Arrange - Tất cả parameters hợp lệ
      const validData = {
        page: 2,
        limit: 20,
        isDone: 'false',
        search: 'test',
        dateFrom: '2024-01-01T00:00:00.000Z',
        dateTo: '2024-12-31T23:59:59.999Z',
        sortBy: 'title',
        sortOrder: 'asc',
      };

      // Act - Validate dữ liệu
      const dto = plainToClass(QueryTodoDto, validData);
      const errors = await validate(dto);

      // Assert - Không có lỗi validation
      expect(errors).toHaveLength(0);
    });
  });

  // ===== TEST ValidationPipe Integration =====
  describe('ValidationPipe Integration', () => {
    let validationPipe: ValidationPipe;

    beforeEach(() => {
      // Tạo ValidationPipe với cấu hình test
      validationPipe = new ValidationPipe({
        whitelist: true, // Chỉ cho phép các field được định nghĩa
        forbidNonWhitelisted: true, // Từ chối nếu có field không được định nghĩa
        transform: true, // Tự động transform types
      });
    });

    it('should transform and validate CreateUsersDto correctly', async () => {
      // Arrange - Dữ liệu raw từ request
      const rawData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      // Act - Transform và validate
      const result = await validationPipe.transform(rawData, {
        type: 'body',
        metatype: CreateUsersDto,
      } as any);

      // Assert - Kết quả đã được transform thành DTO
      expect(result).toBeInstanceOf(CreateUsersDto);
      expect(result.username).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBe('password123');
    });

    it('should throw BadRequestException for invalid CreateUsersDto', async () => {
      // Arrange - Dữ liệu không hợp lệ
      const invalidData = {
        username: '', // Rỗng
        email: 'invalid-email', // Email không hợp lệ
        password: '123', // Quá ngắn
      };

      // Act & Assert - ValidationPipe sẽ throw BadRequestException
      await expect(
        validationPipe.transform(invalidData, {
          type: 'body',
          metatype: CreateUsersDto,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should transform and validate LoginDto correctly', async () => {
      // Arrange - Dữ liệu raw từ request
      const rawData = {
        usernameOrEmail: 'testuser',
        password: 'password123',
      };

      // Act - Transform và validate
      const result = await validationPipe.transform(rawData, {
        type: 'body',
        metatype: LoginDto,
      } as any);

      // Assert - Kết quả đã được transform thành DTO
      expect(result).toBeInstanceOf(LoginDto);
      expect(result.usernameOrEmail).toBe('testuser');
      expect(result.password).toBe('password123');
    });

    it('should transform and validate CreateTodoDto correctly', async () => {
      // Arrange - Dữ liệu raw từ request
      const rawData = {
        title: 'Test Todo',
        description: 'Test Description',
        isDone: false,
      };

      // Act - Transform và validate
      const result = await validationPipe.transform(rawData, {
        type: 'body',
        metatype: CreateTodoDto,
      } as any);

      // Assert - Kết quả đã được transform thành DTO
      expect(result).toBeInstanceOf(CreateTodoDto);
      expect(result.title).toBe('Test Todo');
      expect(result.description).toBe('Test Description');
      expect(result.isDone).toBe(false);
    });

    it('should transform and validate QueryTodoDto correctly', async () => {
      // Arrange - Dữ liệu raw từ query parameters
      const rawData = {
        page: '1', // String từ query params
        limit: '10', // String từ query params
        isDone: 'true', // String từ query params
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      // Act - Transform và validate
      const result = await validationPipe.transform(rawData, {
        type: 'query',
        metatype: QueryTodoDto,
      } as any);

      // Assert - Kết quả đã được transform thành DTO
      expect(result).toBeInstanceOf(QueryTodoDto);
      expect(result.page).toBe(1); // Đã transform từ string sang number
      expect(result.limit).toBe(10); // Đã transform từ string sang number
      expect(result.isDone).toBe('true'); // Giữ nguyên string cho boolean string
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('desc');
    });
  });
});
