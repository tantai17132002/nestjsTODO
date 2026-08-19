import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TodosService } from '@/modules/todos/todos.service';
import { CreateTodoDto } from '@/modules/todos/dto/create-todo.dto';
import { UpdateTodoDto } from '@/modules/todos/dto/update-todo.dto';
import { QueryTodoDto } from '@/modules/todos/dto/query-todo.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TodoResponseDto } from '@/modules/todos/dto/todo-response.dto';
import { TodoPaginationResponseDto } from '@/modules/todos/dto/todo-pagination-response.dto';
import { DeletedResponseDto } from '@/common/dto/deleted-response.dto';
import {
  ValidationErrorResponseDto,
  UnauthorizedErrorResponseDto,
  ForbiddenErrorResponseDto,
  NotFoundErrorResponseDto,
} from '@/common/dto/error-response.dto';
import type { JwtUser } from '@/common/types';

/**
 * TodosController - Controller xử lý các HTTP requests cho module Todos
 *
 * Controller này chỉ chịu trách nhiệm:
 * - Routing: Định tuyến HTTP requests đến đúng endpoints
 * - Input/Output: Nhận request và trả về response
 * - Validation: Validate input thông qua DTOs và ValidationPipe
 * - Authentication: JWT authentication thông qua Guards
 * - Gọi Service: Delegate business logic cho TodosService
 *
 * Business logic và logging được xử lý trong TodosService
 *
 * Endpoints:
 * - POST /todos: Tạo todo mới
 * - GET /todos: Lấy danh sách todos với pagination/filtering
 * - GET /todos/:id: Lấy thông tin todo theo ID
 * - PATCH /todos/:id: Cập nhật todo
 * - DELETE /todos/:id: Xóa todo
 *
 * @description
 * Tất cả endpoints đều yêu cầu xác thực JWT
 * Tuân thủ nguyên tắc: Controller chỉ routing + I/O, Service xử lý business logic
 */
@ApiTags('Todos')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  /**
   * POST /todos
   * Tạo todo mới
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate input (thông qua DTOs và ValidationPipe)
   * - Gọi TodosService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong TodosService.createTodo()
   *
   * @param user - Thông tin user từ JWT token (tự động inject bởi @CurrentUser())
   * @param dto - Dữ liệu để tạo todo (từ request body)
   * @returns Todo đã được tạo
   */
  @ApiOperation({ summary: 'Create a new todo' })
  @ApiBody({ type: CreateTodoDto })
  @ApiResponse({
    status: 201,
    description: 'Todo created successfully',
    type: TodoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTodoDto) {
    return this.todosService.createTodo(user, dto);
  }

  /**
   * GET /todos
   * Lấy danh sách todos với phân trang, filtering và sorting nâng cao
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate query parameters (thông qua DTOs và ValidationPipe)
   * - Gọi TodosService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong TodosService.findAllTodos()
   *
   * Hỗ trợ các tính năng:
   * - Pagination: page, limit (max 100 items/page)
   * - Filtering: isDone, search (title/description), dateFrom, dateTo
   * - Sorting: sortBy, sortOrder
   * - Authorization: admin thấy tất cả, user chỉ thấy của mình
   *
   * @param user - Thông tin user từ JWT token
   * @param query - Các tham số query với đầy đủ filter options
   * @returns Object chứa danh sách todos, metadata pagination và filters applied
   *
   * @example
   * // Cơ bản: GET /todos?page=1&limit=10
   * // Filter: GET /todos?isDone=true&search=typescript
   * // Date range: GET /todos?dateFrom=2024-01-01T00:00:00.000Z&dateTo=2024-12-31T23:59:59.999Z
   * // Sorting: GET /todos?sortBy=createdAt&sortOrder=desc
   * // Kết hợp: GET /todos?page=2&limit=20&isDone=false&search=learn&sortBy=title&sortOrder=asc
   */
  @ApiOperation({
    summary: 'Get all todos with advanced pagination, filtering and sorting',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (min: 1)',
    example: 1,
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Items per page (min: 1, max: 100)',
    example: 10,
    required: false,
  })
  @ApiQuery({
    name: 'isDone',
    description: 'Filter by completion status',
    example: 'true',
    required: false,
    enum: ['true', 'false'],
  })
  @ApiQuery({
    name: 'search',
    description: 'Search in title or description (case-insensitive)',
    example: 'typescript',
    required: false,
  })
  @ApiQuery({
    name: 'dateFrom',
    description: 'Filter todos created from this date (ISO format)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @ApiQuery({
    name: 'dateTo',
    description: 'Filter todos created until this date (ISO format)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @ApiQuery({
    name: 'sortBy',
    description: 'Sort by field',
    example: 'createdAt',
    required: false,
    enum: ['id', 'title', 'isDone', 'createdAt', 'updatedAt'],
  })
  @ApiQuery({
    name: 'sortOrder',
    description: 'Sort order',
    example: 'desc',
    required: false,
    enum: ['asc', 'desc'],
  })
  @ApiResponse({
    status: 200,
    description: 'Todos retrieved successfully with pagination metadata',
    type: TodoPaginationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid query parameters',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() query: QueryTodoDto) {
    return this.todosService.findAllTodos(user, query);
  }

  /**
   * GET /todos/:id
   * Lấy thông tin chi tiết một todo theo ID
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate path parameter (thông qua ParseIntPipe)
   * - Gọi TodosService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong TodosService.findOneTodo()
   *
   * @param user - Thông tin user từ JWT token
   * @param id - ID của todo (tự động convert string thành number bởi ParseIntPipe)
   * @returns Todo entity
   * @throws NotFoundException nếu không tìm thấy todo
   * @throws ForbiddenException nếu user không có quyền truy cập
   *
   * Ví dụ: GET /todos/123
   */
  @ApiOperation({ summary: 'Get a specific todo by ID' })
  @ApiParam({ name: 'id', description: 'Todo ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Todo retrieved successfully',
    type: TodoResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Todo not found',
    type: NotFoundErrorResponseDto,
  })
  @Get(':id')
  findOne(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOneTodo(id, user);
  }

  /**
   * PATCH /todos/:id
   * Cập nhật thông tin todo
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate path parameter và body (thông qua ParseIntPipe và DTOs)
   * - Gọi TodosService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong TodosService.updateTodo()
   *
   * @param user - Thông tin user từ JWT token
   * @param id - ID của todo cần cập nhật
   * @param dto - Dữ liệu cập nhật (từ request body)
   * @returns Todo đã được cập nhật
   * @throws NotFoundException nếu không tìm thấy todo
   * @throws ForbiddenException nếu user không có quyền cập nhật
   *
   * Ví dụ: PATCH /todos/123 với body: { "title": "New title", "isDone": true }
   */
  @ApiOperation({ summary: 'Update a todo' })
  @ApiParam({ name: 'id', description: 'Todo ID', example: 1 })
  @ApiBody({ type: UpdateTodoDto })
  @ApiResponse({
    status: 200,
    description: 'Todo updated successfully',
    type: TodoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
    type: ValidationErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Todo not found',
    type: NotFoundErrorResponseDto,
  })
  @Patch(':id')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.updateTodo(id, user, dto);
  }

  /**
   * DELETE /todos/:id
   * Xóa todo
   *
   * Controller chỉ chịu trách nhiệm:
   * - Nhận request từ client
   * - Validate path parameter (thông qua ParseIntPipe)
   * - Gọi TodosService để xử lý business logic
   * - Trả về response cho client
   *
   * Business logic được xử lý trong TodosService.removeTodo()
   *
   * @param user - Thông tin user từ JWT token
   * @param id - ID của todo cần xóa
   * @returns Object thông báo xóa thành công
   * @throws NotFoundException nếu không tìm thấy todo
   * @throws ForbiddenException nếu user không có quyền xóa
   *
   * Ví dụ: DELETE /todos/123
   */
  @ApiOperation({ summary: 'Delete a todo' })
  @ApiParam({ name: 'id', description: 'Todo ID', example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Todo deleted successfully',
    type: DeletedResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Access denied',
    type: ForbiddenErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Todo not found',
    type: NotFoundErrorResponseDto,
  })
  @Delete(':id')
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.removeTodo(id, user);
  }
}
