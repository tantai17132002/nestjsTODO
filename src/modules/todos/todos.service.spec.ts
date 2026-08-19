import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TodosService } from '@/modules/todos/todos.service';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { CreateTodoDto } from '@/modules/todos/dto/create-todo.dto';
import { UpdateTodoDto } from '@/modules/todos/dto/update-todo.dto';
import { QueryTodoDto } from '@/modules/todos/dto/query-todo.dto';
import type { JwtUser } from '@/common/types';
import { CustomLogger } from '@/common/logger/custom-logger.service';

/**
 * Unit Tests cho TodosService
 *
 * Mục tiêu:
 * - Test logic nghiệp vụ riêng lẻ trong service
 * - Mock hoàn toàn repository để không chạm DB thật
 * - Test nhanh, chạy nhiều lần an toàn
 * - Tập trung vào business logic, không phải data persistence
 */
describe('TodosService', () => {
  let service: TodosService;
  let todoRepository: jest.Mocked<Repository<TodoEntity>>;

  // Mock data cho tests - dữ liệu giả để test
  const mockTodo = {
    id: 1,
    title: 'Test Todo',
    description: 'Test Description',
    isDone: false,
    ownerId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock user thường
  const mockUser: JwtUser = {
    id: 1,
    username: 'testuser',
    role: 'user',
  };

  // Mock admin user
  const mockAdminUser: JwtUser = {
    id: 2,
    username: 'admin',
    role: 'admin',
  };

  // DTO cho việc tạo todo mới
  const mockCreateTodoDto: CreateTodoDto = {
    title: 'New Todo',
    description: 'New Description',
    isDone: false,
  };

  // DTO cho việc cập nhật todo
  const mockUpdateTodoDto: UpdateTodoDto = {
    title: 'Updated Todo',
    isDone: true,
  };

  // DTO cho việc query todos với pagination
  const mockQueryTodoDto: QueryTodoDto = {
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  beforeEach(async () => {
    // Thiết lập module test với mock repository và CustomLogger
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: getRepositoryToken(TodoEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            remove: jest.fn(),
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

    service = module.get<TodosService>(TodosService);
    todoRepository = module.get(getRepositoryToken(TodoEntity));
  });

  afterEach(() => {
    // Xóa tất cả mock sau mỗi test để tránh ảnh hưởng lẫn nhau
    jest.clearAllMocks();
  });

  /**
   * Test createTodo method - Tạo todo mới
   * Method này tạo todo mới và gán cho user hiện tại
   */
  describe('createTodo', () => {
    it('should create todo successfully with owner assignment', async () => {
      // Arrange - Chuẩn bị todo mới với owner
      const expectedTodo = {
        ...mockTodo,
        ...mockCreateTodoDto,
        ownerId: mockUser.id,
      };
      todoRepository.create.mockReturnValue(expectedTodo as any);
      todoRepository.save.mockResolvedValue(expectedTodo as any);

      // Act - Tạo todo mới
      const result = await service.createTodo(mockUser, mockCreateTodoDto);

      // Assert - Kiểm tra todo được tạo với owner đúng
      expect(todoRepository.create).toHaveBeenCalledWith({
        ...mockCreateTodoDto,
        ownerId: mockUser.id,
      });
      expect(todoRepository.save).toHaveBeenCalledWith(expectedTodo);
      expect(result).toEqual(expectedTodo);
    });

    it('should set default isDone to false when not provided', async () => {
      // Arrange - Test khi không cung cấp isDone
      const createDtoWithoutIsDone = { title: 'Test', description: 'Test' };
      const expectedTodo = {
        ...mockTodo,
        ...createDtoWithoutIsDone,
        isDone: false,
        ownerId: mockUser.id,
      };

      todoRepository.create.mockReturnValue(expectedTodo as any);
      todoRepository.save.mockResolvedValue(expectedTodo as any);

      // Act - Tạo todo không có isDone
      const result = await service.createTodo(mockUser, createDtoWithoutIsDone);

      // Assert - Kiểm tra isDone được set mặc định là false
      expect(todoRepository.create).toHaveBeenCalledWith({
        ...createDtoWithoutIsDone,
        isDone: false,
        ownerId: mockUser.id,
      });
      expect(result).toEqual(expectedTodo);
    });
  });

  /**
   * Test findAllTodos - Logic phân trang
   * Method này lấy danh sách todos với pagination
   */
  describe('findAllTodos - Pagination Logic', () => {
    it('should calculate pagination parameters correctly', async () => {
      // Arrange - Test tính toán pagination
      const query = { page: 3, limit: 5 };
      const todos = [mockTodo] as any;
      const total = 25;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Lấy todos với pagination
      const result = await service.findAllTodos(mockUser, query);

      // Assert - Kiểm tra tính toán pagination đúng
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id },
        order: { createdAt: 'DESC' },
        skip: 10, // (3-1) * 5 = 10
        take: 5,
      });
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPrevPage).toBe(true);
    });

    it('should enforce maximum limit of 100', async () => {
      // Arrange - Test giới hạn tối đa 100 items
      const query = { page: 1, limit: 150 };
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Lấy todos với limit vượt quá 100
      const result = await service.findAllTodos(mockUser, query);

      // Assert - Kiểm tra limit được giới hạn ở 100
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 100, // Phải được giới hạn ở 100
      });
      expect(result.pagination.limit).toBe(100);
    });
  });

  /**
   * Test findAllTodos - Logic phân quyền
   * Method này kiểm tra quyền truy cập todos
   */
  describe('findAllTodos - Authorization Logic', () => {
    it('should filter todos by ownerId for regular users', async () => {
      // Arrange - Test user thường chỉ thấy todos của mình
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - User thường lấy todos
      await service.findAllTodos(mockUser, mockQueryTodoDto);

      // Assert - Kiểm tra chỉ lấy todos của user này
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });

    it('should return all todos for admin users', async () => {
      // Arrange - Test admin có thể thấy tất cả todos
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Admin lấy todos
      await service.findAllTodos(mockAdminUser, mockQueryTodoDto);

      // Assert - Kiểm tra admin thấy tất cả todos
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: {}, // Không filter theo ownerId cho admin
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });
  });

  /**
   * Test findAllTodos - Logic lọc dữ liệu
   * Method này áp dụng các filter cho việc tìm kiếm todos
   */
  describe('findAllTodos - Filtering Logic', () => {
    it('should apply isDone filter correctly', async () => {
      // Arrange - Test filter theo trạng thái hoàn thành
      const queryWithFilter = { ...mockQueryTodoDto, isDone: 'true' };
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Lọc todos đã hoàn thành
      const result = await service.findAllTodos(mockUser, queryWithFilter);

      // Assert - Kiểm tra filter isDone được áp dụng
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id, isDone: true },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
      expect(result.filters.isDone).toBe('true');
    });

    it('should apply search filter with ILike without dropping owner scope', async () => {
      const queryWithSearch = { ...mockQueryTodoDto, search: 'typescript' };
      todoRepository.findAndCount.mockResolvedValue([[mockTodo] as any, 1]);

      const result = await service.findAllTodos(mockUser, queryWithSearch);
      const call = todoRepository.findAndCount.mock.calls[0][0] as {
        where: Array<Record<string, unknown>>;
      };
      expect(call.where).toHaveLength(2);
      expect(call.where[0].ownerId).toBe(mockUser.id);
      expect(call.where[0].title).toBeDefined();
      expect(call.where[1].ownerId).toBe(mockUser.id);
      expect(call.where[1].description).toBeDefined();
      expect(result.filters.search).toBe('typescript');
    });

    it('should keep owner AND isDone AND search as OR only for title/description', async () => {
      const query = { ...mockQueryTodoDto, isDone: 'false', search: 'nest' };
      todoRepository.findAndCount.mockResolvedValue([[mockTodo] as any, 1]);

      await service.findAllTodos(mockUser, query);

      const call = todoRepository.findAndCount.mock.calls[0][0] as {
        where: Array<Record<string, unknown>>;
      };
      expect(call.where[0]).toMatchObject({ ownerId: mockUser.id, isDone: false });
      expect(call.where[0].title).toBeDefined();
      expect(call.where[1]).toMatchObject({ ownerId: mockUser.id, isDone: false });
      expect(call.where[1].description).toBeDefined();
    });

    it('should not apply owner condition for admin even when filters are combined', async () => {
      const query = { ...mockQueryTodoDto, isDone: 'true', search: 'nest' };
      todoRepository.findAndCount.mockResolvedValue([[mockTodo] as any, 1]);

      await service.findAllTodos(mockAdminUser, query);

      const call = todoRepository.findAndCount.mock.calls[0][0] as {
        where: Array<Record<string, unknown>>;
      };
      expect(call.where[0].ownerId).toBeUndefined();
      expect(call.where[0].isDone).toBe(true);
      expect(call.where[0].title).toBeDefined();
    });
  });

  /**
   * Test findAllTodos - Logic sắp xếp
   * Method này áp dụng sorting cho danh sách todos
   */
  describe('findAllTodos - Sorting Logic', () => {
    it('should apply default sorting (createdAt DESC)', async () => {
      // Arrange - Test sắp xếp mặc định
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Lấy todos với sắp xếp mặc định
      await service.findAllTodos(mockUser, mockQueryTodoDto);

      // Assert - Kiểm tra sắp xếp mặc định theo createdAt DESC
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 10,
      });
    });

    it('should apply custom sorting parameters', async () => {
      // Arrange - Test sắp xếp tùy chỉnh
      const queryWithSort = {
        ...mockQueryTodoDto,
        sortBy: 'title',
        sortOrder: 'asc' as const,
      };
      const todos = [mockTodo] as any;
      const total = 1;
      todoRepository.findAndCount.mockResolvedValue([todos, total]);

      // Act - Lấy todos với sắp xếp tùy chỉnh
      const result = await service.findAllTodos(mockUser, queryWithSort);

      // Assert - Kiểm tra sắp xếp tùy chỉnh được áp dụng
      expect(todoRepository.findAndCount).toHaveBeenCalledWith({
        where: { ownerId: mockUser.id },
        order: { title: 'ASC' },
        skip: 0,
        take: 10,
      });
      expect(result.filters.sortBy).toBe('title');
      expect(result.filters.sortOrder).toBe('asc');
    });

    it('should throw BadRequestException for invalid sort field', async () => {
      // Arrange - Test trường sắp xếp không hợp lệ
      const invalidQuery = { ...mockQueryTodoDto, sortBy: 'invalidField' };

      // Act & Assert - Kiểm tra exception khi sort field không hợp lệ
      await expect(service.findAllTodos(mockUser, invalidQuery)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAllTodos(mockUser, invalidQuery)).rejects.toThrow(
        'Invalid sort field: invalidField',
      );
    });
  });

  /**
   * Test findOneTodo - Logic phân quyền
   * Method này kiểm tra quyền truy cập todo cụ thể
   */
  describe('findOneTodo - Authorization Logic', () => {
    it('should return todo when user is owner', async () => {
      // Arrange - Test user là chủ sở hữu todo
      todoRepository.findOne.mockResolvedValue(mockTodo as any);

      // Act - User lấy todo của mình
      const result = await service.findOneTodo(1, mockUser);

      // Assert - Kiểm tra user có thể truy cập todo của mình
      expect(todoRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockTodo);
    });

    it('should return todo when user is admin (even if not owner)', async () => {
      // Arrange - Test admin có thể truy cập todo của user khác
      const todoNotOwned = { ...mockTodo, ownerId: 999 };
      todoRepository.findOne.mockResolvedValue(todoNotOwned as any);

      // Act - Admin lấy todo của user khác
      const result = await service.findOneTodo(1, mockAdminUser);

      // Assert - Kiểm tra admin có thể truy cập
      expect(result).toEqual(todoNotOwned);
    });

    it('should throw NotFoundException when todo not found', async () => {
      // Arrange - Test todo không tồn tại
      todoRepository.findOne.mockResolvedValue(null);

      // Act & Assert - Kiểm tra exception khi todo không tồn tại
      await expect(service.findOneTodo(999, mockUser)).rejects.toThrow(NotFoundException);
      await expect(service.findOneTodo(999, mockUser)).rejects.toThrow('Todo not found');
    });

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Test user không phải chủ sở hữu và không phải admin
      const todoNotOwned = { ...mockTodo, ownerId: 999 };
      todoRepository.findOne.mockResolvedValue(todoNotOwned as any);

      // Act & Assert - Kiểm tra exception khi không có quyền truy cập
      await expect(service.findOneTodo(1, mockUser)).rejects.toThrow(ForbiddenException);
      await expect(service.findOneTodo(1, mockUser)).rejects.toThrow(
        'You are not allowed to access this resource',
      );
    });
  });

  /**
   * Test updateTodo - Logic nghiệp vụ
   * Method này cập nhật todo với kiểm tra quyền
   */
  describe('updateTodo - Business Logic', () => {
    it('should update todo successfully when user has access', async () => {
      // Arrange - Test cập nhật todo thành công
      const updatedTodo = { ...mockTodo, ...mockUpdateTodoDto };
      todoRepository.findOne.mockResolvedValue(mockTodo as any);
      todoRepository.save.mockResolvedValue(updatedTodo as any);

      // Act - Cập nhật todo
      const result = await service.updateTodo(1, mockUser, mockUpdateTodoDto);

      // Assert - Kiểm tra todo được cập nhật thành công
      expect(todoRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(todoRepository.save).toHaveBeenCalledWith(updatedTodo);
      expect(result).toEqual(updatedTodo);
    });

    it('should preserve existing fields when not provided in update', async () => {
      // Arrange - Test cập nhật một phần (partial update)
      const partialUpdate = { title: 'Only Title Update' };
      const updatedTodo = { ...mockTodo, title: 'Only Title Update' };
      todoRepository.findOne.mockResolvedValue(mockTodo as any);
      todoRepository.save.mockResolvedValue(updatedTodo as any);

      // Act - Cập nhật chỉ title
      const result = await service.updateTodo(1, mockUser, partialUpdate);

      // Assert - Kiểm tra các field khác được giữ nguyên
      expect(result.title).toBe('Only Title Update');
      expect(result.description).toBe(mockTodo.description); // Giữ nguyên
      expect(result.isDone).toBe(mockTodo.isDone); // Giữ nguyên
    });

    it('should throw NotFoundException when todo not found', async () => {
      // Arrange - Test todo không tồn tại khi cập nhật
      todoRepository.findOne.mockResolvedValue(null);

      // Act & Assert - Kiểm tra exception khi todo không tồn tại
      await expect(service.updateTodo(999, mockUser, mockUpdateTodoDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when update body is empty', async () => {
      await expect(service.updateTodo(1, mockUser, {})).rejects.toThrow(BadRequestException);
      expect(todoRepository.findOne).not.toHaveBeenCalled();
    });
  });

  /**
   * Test removeTodo - Logic nghiệp vụ
   * Method này xóa todo với kiểm tra quyền
   */
  describe('removeTodo - Business Logic', () => {
    it('should remove todo successfully when user has access', async () => {
      // Arrange - Test xóa todo thành công
      todoRepository.findOne.mockResolvedValue(mockTodo as any);
      todoRepository.remove.mockResolvedValue(mockTodo as any);

      // Act - Xóa todo
      const result = await service.removeTodo(1, mockUser);

      // Assert - Kiểm tra todo được xóa thành công
      expect(todoRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(todoRepository.remove).toHaveBeenCalledWith(mockTodo);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException when todo not found', async () => {
      // Arrange - Test todo không tồn tại khi xóa
      todoRepository.findOne.mockResolvedValue(null);

      // Act & Assert - Kiểm tra exception khi todo không tồn tại
      await expect(service.removeTodo(999, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not owner and not admin', async () => {
      // Arrange - Test user không có quyền xóa
      const todoNotOwned = { ...mockTodo, ownerId: 999 };
      todoRepository.findOne.mockResolvedValue(todoNotOwned as any);

      // Act & Assert - Kiểm tra exception khi không có quyền
      await expect(service.removeTodo(1, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  /**
   * Test assertCanAccess - Logic phân quyền nội bộ
   * Method private này kiểm tra quyền truy cập
   */
  describe('assertCanAccess - Authorization Logic', () => {
    it('should allow admin to access any todo', () => {
      // Arrange - Test admin có thể truy cập todo của user khác
      const todoNotOwned = { ...mockTodo, ownerId: 999 };

      // Act & Assert - Kiểm tra admin có quyền truy cập
      expect(() => service['assertCanAccess'](todoNotOwned as any, mockAdminUser)).not.toThrow();
    });

    it('should allow user to access their own todo', () => {
      // Act & Assert - Kiểm tra user có thể truy cập todo của mình
      expect(() => service['assertCanAccess'](mockTodo as any, mockUser)).not.toThrow();
    });

    it('should throw ForbiddenException when user tries to access other user todo', () => {
      // Arrange - Test user không thể truy cập todo của user khác
      const todoNotOwned = { ...mockTodo, ownerId: 999 };

      // Act & Assert - Kiểm tra exception khi không có quyền truy cập
      expect(() => service['assertCanAccess'](todoNotOwned as any, mockUser)).toThrow(
        ForbiddenException,
      );
      expect(() => service['assertCanAccess'](todoNotOwned as any, mockUser)).toThrow(
        'You are not allowed to access this resource',
      );
    });
  });
});
