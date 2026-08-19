import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  LessThanOrEqual,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { CreateTodoDto } from '@/modules/todos/dto/create-todo.dto';
import { UpdateTodoDto } from '@/modules/todos/dto/update-todo.dto';
import { QueryTodoDto } from '@/modules/todos/dto/query-todo.dto';
import { TodoPaginationResponseDto } from '@/modules/todos/dto/todo-pagination-response.dto';
import { TodoResponseDto } from '@/modules/todos/dto/todo-response.dto';
import { DeletedResponseDto } from '@/common/dto/deleted-response.dto';
import { toPublicTodo } from '@/modules/todos/mappers/todo.mapper';
import type { JwtUser } from '@/common/types';
import { ADMIN_ROLE } from '@/common/constants/roles.constant';
import { CustomLogger } from '@/common/logger/custom-logger.service';

const ALLOWED_SORT_FIELDS = ['id', 'title', 'isDone', 'createdAt', 'updatedAt'] as const;

/**
 * Xử lý CRUD todo, cô lập dữ liệu theo owner và ghép filter bằng AND.
 */
@Injectable()
export class TodosService {
  constructor(
    @InjectRepository(TodoEntity)
    private readonly todoRepository: Repository<TodoEntity>,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Tạo todo mới; ownerId luôn lấy từ user đã xác thực.
   *
   * @param owner Người dùng từ JWT.
   * @param dto title bắt buộc; description và isDone tùy chọn.
   * @returns Todo công khai vừa tạo.
   */
  async createTodo(owner: JwtUser, dto: CreateTodoDto): Promise<TodoResponseDto> {
    this.logger.log(`Creating todo for user: ${owner.username} (ID: ${owner.id})`);

    const todo = this.todoRepository.create({
      title: dto.title,
      description: dto.description,
      isDone: dto.isDone ?? false,
      ownerId: owner.id,
    });

    const savedTodo = await this.todoRepository.save(todo);
    this.logger.log(`Todo created successfully: ${savedTodo.title} (ID: ${savedTodo.id})`);
    return toPublicTodo(savedTodo);
  }

  /**
   * Lấy danh sách todo theo quyền: user chỉ thấy của mình, admin thấy tất cả.
   * Điều kiện owner luôn AND với filter để không lộ todo của người khác.
   *
   * @param user Người dùng đã xác thực.
   * @param query Phân trang, lọc, tìm kiếm và sắp xếp.
   * @returns Danh sách todo, pagination và filters đã áp dụng.
   */
  async findAllTodos(user: JwtUser, query: QueryTodoDto): Promise<TodoPaginationResponseDto> {
    this.logger.debug?.(`Finding todos for user: ${user.username} (ID: ${user.id})`);

    const { page, limit, skip } = this.buildPaginationParams(query);
    const where = this.buildWhereConditions(user, query);
    const order = this.buildOrderClause(query);

    const [todos, total] = await this.todoRepository.findAndCount({
      where,
      order,
      skip,
      take: limit,
    });

    this.logger.log(`Found ${todos.length} todos for user: ${user.username} (total: ${total})`);

    return {
      todos: todos.map(toPublicTodo),
      pagination: this.buildPaginationMetadata(page, limit, total),
      filters: this.buildFiltersMetadata(query),
    };
  }

  /**
   * Lấy một todo theo ID. 404 nếu không tồn tại; 403 nếu không phải owner và không phải admin.
   *
   * @param id ID todo.
   * @param user Người dùng đã xác thực.
   * @returns Todo công khai.
   */
  async findOneTodo(id: number, user: JwtUser): Promise<TodoResponseDto> {
    this.logger.debug?.(`Finding todo ID: ${id} for user: ${user.username} (ID: ${user.id})`);

    const todo = await this.todoRepository.findOne({ where: { id } });
    if (!todo) {
      this.logger.warn(`Todo not found: ID ${id} requested by user: ${user.username}`);
      throw new NotFoundException('Todo not found');
    }

    this.assertCanAccess(todo, user);
    return toPublicTodo(todo);
  }

  /**
   * Cập nhật todo. Không cho sửa ownerId/id/timestamp; body rỗng bị từ chối.
   *
   * @param id ID todo.
   * @param user Người dùng đã xác thực.
   * @param dto Ít nhất một trong title, description, isDone.
   * @returns Todo sau cập nhật.
   */
  async updateTodo(id: number, user: JwtUser, dto: UpdateTodoDto): Promise<TodoResponseDto> {
    this.logger.log(`Updating todo ID: ${id} for user: ${user.username} (ID: ${user.id})`);

    if (dto.title === undefined && dto.description === undefined && dto.isDone === undefined) {
      throw new BadRequestException('At least one field must be provided');
    }

    const todo = await this.todoRepository.findOne({ where: { id } });
    if (!todo) {
      this.logger.warn(`Todo not found for update: ID ${id} requested by user: ${user.username}`);
      throw new NotFoundException('Todo not found');
    }

    this.assertCanAccess(todo, user);

    if (dto.title !== undefined) {
      todo.title = dto.title;
    }
    if (dto.description !== undefined) {
      todo.description = dto.description;
    }
    if (dto.isDone !== undefined) {
      todo.isDone = dto.isDone;
    }

    const updatedTodo = await this.todoRepository.save(todo);
    this.logger.log(
      `Todo updated successfully: ${updatedTodo.title} (ID: ${updatedTodo.id}) by user: ${user.username}`,
    );
    return toPublicTodo(updatedTodo);
  }

  /**
   * Xóa cứng todo nếu user là owner hoặc admin.
   *
   * @param id ID todo.
   * @param user Người dùng đã xác thực.
   * @returns `{ deleted: true }`.
   */
  async removeTodo(id: number, user: JwtUser): Promise<DeletedResponseDto> {
    this.logger.log(`Removing todo ID: ${id} for user: ${user.username} (ID: ${user.id})`);

    const todo = await this.todoRepository.findOne({ where: { id } });
    if (!todo) {
      this.logger.warn(`Todo not found for deletion: ID ${id} requested by user: ${user.username}`);
      throw new NotFoundException('Todo not found');
    }

    this.assertCanAccess(todo, user);
    const todoId = todo.id;
    const todoTitle = todo.title;
    await this.todoRepository.remove(todo);

    this.logger.log(
      `Todo deleted successfully: ${todoTitle} (ID: ${todoId}) by user: ${user.username}`,
    );
    return { deleted: true };
  }

  /**
   * Tính page/limit/skip; limit tối đa 100 để tránh tải quá lớn.
   */
  private buildPaginationParams(query: QueryTodoDto): {
    page: number;
    limit: number;
    skip: number;
  } {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  /**
   * Ghép điều kiện: owner AND isDone AND dateRange AND (title ILIKE OR description ILIKE).
   * Không đưa từng filter thành phần tử độc lập trong mảng `where` vì TypeORM hiểu mảng là OR.
   */
  private buildWhereConditions(
    user: JwtUser,
    query: QueryTodoDto,
  ): FindOptionsWhere<TodoEntity> | FindOptionsWhere<TodoEntity>[] {
    const base: FindOptionsWhere<TodoEntity> = {};

    if (user.role !== ADMIN_ROLE) {
      base.ownerId = user.id;
    }

    if (query.isDone !== undefined) {
      base.isDone = query.isDone === 'true';
    }

    Object.assign(base, this.buildDateFilter(query.dateFrom, query.dateTo));

    if (!query.search) {
      return base;
    }

    const searchTerm = `%${query.search}%`;
    // LOWER + LIKE tương đương ILIKE trên PostgreSQL và chạy được trên SQLite khi test.
    return [
      {
        ...base,
        title: Raw((alias) => `LOWER(${alias}) LIKE LOWER(:titleSearch)`, {
          titleSearch: searchTerm,
        }),
      },
      {
        ...base,
        description: Raw((alias) => `LOWER(${alias}) LIKE LOWER(:descSearch)`, {
          descSearch: searchTerm,
        }),
      },
    ];
  }

  /**
   * Lọc createdAt theo cận dưới/trên độc lập, không mặc định về epoch hoặc thời điểm hiện tại.
   */
  private buildDateFilter(dateFrom?: string, dateTo?: string): FindOptionsWhere<TodoEntity> {
    if (dateFrom && dateTo) {
      return { createdAt: Between(new Date(dateFrom), new Date(dateTo)) };
    }
    if (dateFrom) {
      return { createdAt: MoreThanOrEqual(new Date(dateFrom)) };
    }
    if (dateTo) {
      return { createdAt: LessThanOrEqual(new Date(dateTo)) };
    }
    return {};
  }

  /**
   * Chỉ cho sort theo whitelist để tránh nội suy tên cột từ client vào SQL.
   */
  private buildOrderClause(query: QueryTodoDto): Record<string, 'ASC' | 'DESC'> {
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    if (!ALLOWED_SORT_FIELDS.includes(sortBy as (typeof ALLOWED_SORT_FIELDS)[number])) {
      throw new BadRequestException(
        `Invalid sort field: ${sortBy}. Allowed fields: ${ALLOWED_SORT_FIELDS.join(', ')}`,
      );
    }

    return { [sortBy]: sortOrder.toUpperCase() as 'ASC' | 'DESC' };
  }

  /**
   * Metadata phân trang theo hợp đồng API.
   */
  private buildPaginationMetadata(page: number, limit: number, total: number) {
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Echo các filter đã áp dụng để client hiển thị lại UI.
   */
  private buildFiltersMetadata(query: QueryTodoDto) {
    return {
      isDone: query.isDone,
      search: query.search,
      dateFrom: query.dateFrom ?? null,
      dateTo: query.dateTo ?? null,
      sortBy: query.sortBy || 'createdAt',
      sortOrder: query.sortOrder || 'desc',
    };
  }

  /**
   * Admin được truy cập mọi todo; user thường chỉ được todo của mình.
   */
  private assertCanAccess(todo: TodoEntity, user: JwtUser): void {
    if (user.role === ADMIN_ROLE) {
      return;
    }

    if (todo.ownerId !== user.id) {
      this.logger.warn(
        `Access denied: User ${user.username} (ID: ${user.id}) tried to access todo ID ${todo.id} owned by ${todo.ownerId}`,
      );
      throw new ForbiddenException('You are not allowed to access this resource');
    }
  }
}
