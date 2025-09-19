import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { Repository, DataSource } from 'typeorm';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import * as bcrypt from 'bcryptjs'; // Thư viện để băm mật khẩu
import { UpdateRoleDto } from '@/modules/users/dto/update-role.dto';
import { QueryUserDto } from '@/modules/users/dto/query-user.dto';
import { ADMIN_ROLE } from '@/common/constants/roles.constant';
import { CustomLogger } from '@/common/logger/custom-logger.service';

/**
 * UserService - Service xử lý business logic cho user management
 *
 * Dịch vụ này chứa toàn bộ logic nghiệp vụ liên quan đến người dùng:
 *
 * Tính năng bảo mật:
 * - Băm mật khẩu với bcrypt (vòng salt = 10)
 * - Kiểm soát truy cập dựa trên vai trò (quản trị viên/người dùng)
 * - Xác thực và khử trùng đầu vào
 * - Bảo vệ chống hạ cấp quản trị viên
 *
 * Tính năng hiệu suất:
 * - Lưu trữ bộ nhớ đệm trong bộ nhớ cho dữ liệu người dùng
 * - Hỗ trợ phân trang cho các tập dữ liệu lớn
 * - Giao dịch cơ sở dữ liệu cho các hoạt động quan trọng
 * - Truy vấn được tối ưu hóa với TypeORM
 *
 * Logic nghiệp vụ:
 * - Tạo người dùng với kiểm tra trùng lặp
 * - Quản lý vai trò với các quy tắc nghiệp vụ
 * - Khả năng tìm kiếm và lọc
 * - Chiến lược vô hiệu hóa bộ nhớ đệm
 *
 * Hỗ trợ xác thực:
 * - Phương thức trả về mật khẩu cho xác minh đăng nhập
 * - Đăng nhập linh hoạt (tên người dùng hoặc email)
 * - So sánh mật khẩu an toàn
 *
 * Chiến lược ghi nhật ký:
 * - Theo dõi kiểm toán toàn diện
 * - Thông tin gỡ lỗi cho phát triển
 * - Theo dõi và giám sát lỗi
 * - Chỉ số hiệu suất
 *
 * @description
 * Dịch vụ này tuân thủ Nguyên tắc Trách nhiệm Đơn lẻ:
 * - Chỉ xử lý logic nghiệp vụ liên quan đến người dùng
 * - Không chứa các vấn đề HTTP
 * - Ủy quyền truy cập dữ liệu cho Repository
 * - Cung cấp API sạch cho Controller
 */
@Injectable()
export class UserService {
  /**
   * Bộ nhớ đệm trong bộ nhớ để tăng hiệu suất
   *
   * Chiến lược bộ nhớ đệm:
   * - Khóa: ID người dùng (số)
   * - Giá trị: Đối tượng UsersEntity
   * - TTL: Không có (vô hiệu hóa thủ công)
   * - Kích thước: Không giới hạn (cần theo dõi sử dụng bộ nhớ)
   *
   * Hoạt động bộ nhớ đệm:
   * - Đặt: Khi người dùng được truy vấn từ cơ sở dữ liệu
   * - Lấy: Trước khi truy vấn cơ sở dữ liệu
   * - Xóa: Khi dữ liệu người dùng thay đổi
   * - Xóa sạch: Khi cần làm mới toàn bộ bộ nhớ đệm
   *
   * Lợi ích:
   * - Giảm truy vấn cơ sở dữ liệu
   * - Tăng thời gian phản hồi
   * - Giảm tải cơ sở dữ liệu
   *
   * Cân nhắc:
   * - Sử dụng bộ nhớ (cần theo dõi)
   * - Tính nhất quán dữ liệu (vô hiệu hóa thủ công)
   * - Triển khai nhiều instance (bộ nhớ đệm không được chia sẻ)
   */
  private readonly cache = new Map<number, UsersEntity>();

  constructor(
    /**
     * TypeORM Repository cho UsersEntity
     *
     * Mẫu Repository:
     * - Đóng gói các hoạt động cơ sở dữ liệu
     * - Cung cấp truy vấn an toàn về kiểu dữ liệu
     * - Xử lý vòng đời thực thể
     * - Hỗ trợ truy vấn phức tạp
     *
     * Các phương thức có sẵn:
     * - create(): Tạo instance thực thể
     * - save(): Lưu thực thể vào cơ sở dữ liệu
     * - findOne(): Tìm 1 bản ghi
     * - findAndCount(): Tìm nhiều bản ghi với số lượng
     * - count(): Đếm số bản ghi
     * - remove(): Xóa thực thể
     */
    @InjectRepository(UsersEntity)
    private usersRepository: Repository<UsersEntity>,

    /**
     * TypeORM DataSource cho giao dịch
     *
     * Hỗ trợ giao dịch:
     * - Hoạt động nguyên tử
     * - Hoàn tác khi có lỗi
     * - Tính nhất quán dữ liệu
     * - Logic nghiệp vụ phức tạp
     *
     * Trường hợp sử dụng:
     * - Cập nhật vai trò với xác thực
     * - Hoạt động đa bảng
     * - Quy tắc nghiệp vụ quan trọng
     */
    private dataSource: DataSource,

    /**
     * Logger tùy chỉnh cho các hoạt động người dùng
     *
     * Cấp độ ghi nhật ký:
     * - log(): Thông tin quan trọng
     * - debug?(): Thông tin chi tiết (tùy chọn)
     * - warn(): Cảnh báo
     * - error(): Lỗi
     *
     * Sự kiện được ghi nhật ký:
     * - Tạo/xóa người dùng
     * - Thay đổi vai trò
     * - Hoạt động bộ nhớ đệm
     * - Kịch bản lỗi
     * - Chỉ số hiệu suất
     */
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Tạo user mới với mật khẩu đã được mã hóa
   *
   * Luồng bảo mật:
   * 1. Xác thực dữ liệu đầu vào (xác thực DTO)
   * 2. Kiểm tra tính duy nhất của tên người dùng và email
   * 3. Băm mật khẩu với bcrypt
   * 4. Tạo thực thể người dùng
   * 5. Lưu vào cơ sở dữ liệu
   * 6. Trả về người dùng KHÔNG CÓ mật khẩu
   *
   * Tính năng bảo mật:
   * - Băm mật khẩu với số vòng salt = 10
   * - Xác thực tính duy nhất của tên người dùng và email
   * - Khử trùng đầu vào
   * - Phản hồi bảo mật (không có mật khẩu)
   *
   * Xử lý lỗi:
   * - ConflictException: Tên người dùng hoặc email đã tồn tại
   * - Lỗi xác thực: Dữ liệu đầu vào không hợp lệ
   * - Lỗi cơ sở dữ liệu: Sự cố kết nối/ràng buộc
   *
   * Ghi nhật ký:
   * - Gỡ lỗi: Bắt đầu tạo người dùng
   * - Cảnh báo: Xung đột tên người dùng hoặc email
   * - Nhật ký: Tạo thành công
   * - Lỗi: Lỗi trong quá trình tạo
   *
   * @param createUserDto - Dữ liệu user từ client (username, email, password)
   * @returns Promise<Omit<UsersEntity, 'password'>> - User đã được tạo (không có password)
   *
   * @example
   * const newUser = await userService.createUser({
   *   username: "john_doe",
   *   email: "john@example.com",
   *   password: "password123"
   * });
   * // Trả về: { id: 1, username: "john_doe", email: "john@example.com", role: "user", ... }
   * // Mật khẩu được băm và lưu trong cơ sở dữ liệu, không trả về
   */
  async createUser(createUserDto: CreateUsersDto): Promise<Omit<UsersEntity, 'password'>> {
    try {
      // Ghi nhật ký bắt đầu quá trình tạo người dùng
      this.logger.debug?.(`Creating new user: ${createUserDto.username}`);

      // Tách dữ liệu từ DTO để sử dụng
      const { username, email, password } = createUserDto;

      // Kiểm tra tên người dùng đã tồn tại chưa
      // Quy tắc nghiệp vụ: Tên người dùng phải duy nhất
      const existingUser = await this.findByUsername(username);
      if (existingUser) {
        this.logger.warn(`Username already exists: ${username}`);
        throw new ConflictException('Username already exists');
      }

      // Kiểm tra email đã tồn tại chưa
      // Quy tắc nghiệp vụ: Email phải duy nhất
      const existingEmail = await this.findByEmail(email);
      if (existingEmail) {
        this.logger.warn(`Email already exists: ${email}`);
        throw new ConflictException('Email already exists');
      }

      // Băm mật khẩu với bcrypt
      // bcrypt.hash() sẽ tạo ra hash an toàn với salt ngẫu nhiên
      // Số vòng salt = 10: Độ mạnh mã hóa (càng cao càng an toàn nhưng chậm hơn)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Tạo thực thể mới với mật khẩu đã băm
      // Repository.create() tạo instance thực thể nhưng chưa lưu vào DB
      const user = this.usersRepository.create({
        username,
        email,
        password: hashedPassword, // Lưu mật khẩu đã băm, không lưu văn bản thuần
      });

      // Lưu người dùng vào cơ sở dữ liệu
      // Repository.save() thực hiện truy vấn INSERT
      const savedUser = await this.usersRepository.save(user);

      // Loại bỏ mật khẩu khỏi phản hồi để bảo mật
      // Tách dữ liệu để loại bỏ mật khẩu khỏi đối tượng
      // Chỉ trả về thông tin công khai, không bao giờ trả về mật khẩu
      const { password: _, ...userWithoutPassword } = savedUser;

      // Ghi nhật ký thành công
      this.logger.log(`User created successfully: ${username}`);
      return userWithoutPassword;
    } catch (error) {
      // Ném lại ConflictException nếu đã có (tên người dùng đã tồn tại)
      if (error instanceof ConflictException) {
        throw error;
      }

      // Ghi nhật ký lỗi chi tiết cho gỡ lỗi
      this.logger.error(`Failed to create user: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi và trả về phản hồi HTTP phù hợp
      throw error;
    }
  }

  /**
   * Tìm user theo username (bao gồm password) - chỉ dùng cho xác thực
   *
   *  Authentication Purpose
   * - Method này trả về cả password để so sánh khi login
   * - Chỉ sử dụng cho authentication, không dùng cho public access
   * - Password được trả về để verify với bcrypt.compare()
   *
   * Security Warning:
   * - Method này trả về password hash
   * - Chỉ sử dụng trong authentication context
   * - Không expose ra API public
   *
   * Query Strategy:
   * - Single field lookup (username)
   * - Case-sensitive search
   * - Returns null if not found
   *
   * Logging:
   * - Error: Database query failures
   * - No success logging (security)
   *
   * @param username - Tên đăng nhập cần tìm
   * @returns Promise<UsersEntity | null> - User nếu tìm thấy (bao gồm password), null nếu không
   *
   * @example
   * const user = await userService.findByUsername("john_doe");
   * if (user) {
   *   // Có thể truy cập user.password để so sánh với bcrypt.compare()
   *   const isValid = await bcrypt.compare(inputPassword, user.password);
   * }
   */
  async findByUsername(username: string): Promise<UsersEntity | null> {
    try {
      // Tìm người dùng trong cơ sở dữ liệu theo tên người dùng (bao gồm mật khẩu)
      // Repository.findOne() trả về thực thể hoặc null
      const user = await this.usersRepository.findOne({ where: { username } });
      return user;
    } catch (error) {
      // Ghi nhật ký lỗi truy vấn cơ sở dữ liệu
      this.logger.error(`Failed to find user by username: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    }
  }

  /**
   * Tìm user theo email (bao gồm password) - chỉ dùng cho xác thực
   *
   * Authentication Purpose:
   * - Tương tự findByUsername, method này cũng trả về password
   * - Hỗ trợ login bằng email thay vì username
   * - Chỉ sử dụng cho authentication purposes
   *
   * Query Strategy:
   * - Single field lookup (email)
   * - Case-sensitive search
   * - Returns null if not found
   *
   * Logging:
   * - Error: Database query failures
   * - No success logging (security)
   *
   * @param email - Email cần tìm
   * @returns Promise<UsersEntity | null> - User nếu tìm thấy (bao gồm password), null nếu không
   *
   * @example
   * const user = await userService.findByEmail("john@example.com");
   * if (user) {
   *   // Có thể truy cập user.password để so sánh với bcrypt.compare()
   *   const isValid = await bcrypt.compare(inputPassword, user.password);
   * }
   */
  async findByEmail(email: string): Promise<UsersEntity | null> {
    try {
      // Tìm người dùng trong cơ sở dữ liệu theo email (bao gồm mật khẩu)
      // Repository.findOne() trả về thực thể hoặc null
      const user = await this.usersRepository.findOne({ where: { email } });
      return user;
    } catch (error) {
      // Ghi nhật ký lỗi truy vấn cơ sở dữ liệu
      this.logger.error(`Failed to find user by email: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    }
  }

  /**
   * Tìm user theo username hoặc email (bao gồm password) - chỉ dùng cho xác thực
   *
   * Authentication Purpose:
   * - Method này linh hoạt cho phép login bằng username hoặc email
   * - Sử dụng OR condition trong database query
   * - Trả về password để verify authentication
   *
   * Query Strategy:
   * - OR condition: username OR email
   * - Array conditions trong TypeORM
   * - Returns first match hoặc null
   *
   * Use Case:
   * - Login form với field "Username or Email"
   * - Flexible authentication
   * - Better user experience
   *
   * Logging:
   * - Error: Database query failures
   * - No success logging (security)
   *
   * @param usernameOrEmail - Username hoặc email cần tìm
   * @returns Promise<UsersEntity | null> - User nếu tìm thấy (bao gồm password), null nếu không
   *
   * @example
   * const user = await userService.findByUsernameOrEmail("john_doe");
   * const user2 = await userService.findByUsernameOrEmail("john@example.com");
   * // Cả hai đều trả về cùng người dùng nếu username = "john_doe" và email = "john@example.com"
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<UsersEntity | null> {
    try {
      // Tìm người dùng trong cơ sở dữ liệu theo tên người dùng hoặc email (bao gồm mật khẩu)
      // Sử dụng điều kiện mảng để tạo truy vấn OR
      // TypeORM sẽ tạo SQL: WHERE username = ? OR email = ?
      const user = await this.usersRepository.findOne({
        where: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      });
      return user;
    } catch (error) {
      // Ghi nhật ký lỗi truy vấn cơ sở dữ liệu
      this.logger.error(`Failed to find user by username or email: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    }
  }

  /**
   * Lấy tất cả users từ database với pagination (sắp xếp theo thời gian tạo mới nhất)
   *
   * Pagination Features:
   * - Page-based pagination
   * - Configurable page size (1-100)
   * - Total count và metadata
   * - Navigation info (hasNext, hasPrev)
   *
   * Query Features:
   * - Sắp xếp theo createdAt DESC (mới nhất lên đầu)
   * - Skip/Take pagination
   * - Count total records
   *
   * Authorization:
   * - Thường chỉ dùng cho admin
   * - Cần role-based access control
   * - Sensitive data exposure
   *
   * Logging:
   * - Debug: Pagination metrics
   * - Error: Query failures
   *
   * @param query - Query parameters với pagination
   * @returns Promise<Object> - Danh sách users và metadata pagination
   *
   * @example
   * const result = await userService.findAll({ page: 1, limit: 10 });
   * // Trả về: {
   * //   users: [user1, user2, ...],
   * //   pagination: {
   * //     page: 1,
   * //     limit: 10,
   * //     total: 150,
   * //     totalPages: 15,
   * //     hasNextPage: true,
   * //     hasPrevPage: false
   * //   }
   * // }
   */
  async findAll(query?: QueryUserDto): Promise<{ users: UsersEntity[]; pagination: any }> {
    try {
      // Bước 1: Xử lý tham số phân trang
      const page = Math.max(1, query?.page ?? 1); // Đảm bảo trang >= 1
      const limit = Math.min(100, Math.max(1, query?.limit ?? 10)); // Giới hạn tối đa 100 mục/trang
      const skip = (page - 1) * limit; // Tính offset cho truy vấn cơ sở dữ liệu

      // Bước 2: Thực hiện truy vấn với phân trang
      // Repository.findAndCount() trả về [thực thể, tổng số]
      const [users, total] = await this.usersRepository.findAndCount({
        order: { createdAt: 'DESC' }, // Sắp xếp mới nhất lên đầu
        skip, // Bỏ qua bản ghi trước đó
        take: limit, // Lấy số lượng bản ghi cần thiết
      });

      // Bước 3: Tính toán metadata phân trang
      const totalPages = Math.ceil(total / limit); // Tổng số trang
      const hasNextPage = page < totalPages; // Có trang tiếp theo không
      const hasPrevPage = page > 1; // Có trang trước không

      // Ghi nhật ký chỉ số phân trang
      this.logger.debug?.(`Retrieved ${users.length} users (page ${page}/${totalPages})`);

      // Bước 4: Trả về kết quả với metadata
      return {
        users, // Danh sách người dùng cho trang hiện tại
        pagination: {
          page, // Trang hiện tại
          limit, // Số mục/trang
          total, // Tổng số bản ghi
          totalPages, // Tổng số trang
          hasNextPage, // Có trang tiếp theo
          hasPrevPage, // Có trang trước
        },
      };
    } catch (error) {
      // Ghi nhật ký lỗi truy vấn
      this.logger.error(`Failed to retrieve users: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    }
  }

  /**
   * Tìm user theo ID với caching
   *
   * Cache Strategy:
   * - Check cache trước khi query database
   * - Cache user data sau khi query thành công
   * - Manual cache invalidation khi data thay đổi
   * - Memory-based cache (không persistent)
   *
   * Query Flow:
   * 1. Check cache (Map.has())
   * 2. If cache hit: Return cached data
   * 3. If cache miss: Query database
   * 4. Cache result for next access
   * 5. Return user data
   *
   * Error Handling:
   * - NotFoundException: User không tồn tại
   * - Database errors: Connection issues
   * - Cache errors: Memory issues
   *
   * Logging:
   * - Debug: Cache operations
   * - Warn: User not found
   * - Error: Query failures
   *
   * @param id - ID của user cần tìm
   * @returns Promise<UsersEntity> - User nếu tìm thấy
   * @throws NotFoundException - Nếu không tìm thấy user
   *
   * @example
   * const user = await userService.findById(123);
   * // Lần đầu: Truy vấn cơ sở dữ liệu + bộ nhớ đệm
   * // Lần sau: Trả về từ bộ nhớ đệm (nhanh hơn)
   */
  async findById(id: number): Promise<UsersEntity> {
    try {
      // Bước 1: Kiểm tra bộ nhớ đệm trước - nếu có thì trả về ngay
      // Cache hit: Trả về dữ liệu từ bộ nhớ (rất nhanh)
      if (this.cache.has(id)) {
        this.logger.debug?.(`User ${id} found in cache`);
        return this.cache.get(id)!; // Non-null assertion vì đã kiểm tra has()
      }

      // Bước 2: Tìm người dùng theo ID từ cơ sở dữ liệu
      // Cache miss: Truy vấn cơ sở dữ liệu (chậm hơn)
      const user = await this.usersRepository.findOne({ where: { id } });

      //  Bước 3: Nếu không tìm thấy người dùng thì ném NotFoundException
      if (!user) {
        this.logger.warn(`User not found: ${id}`);
        throw new NotFoundException('User not found');
      }

      // Bước 4: Lưu vào bộ nhớ đệm để tăng hiệu suất cho lần truy cập sau
      // Cache dữ liệu người dùng để lần sau không cần truy vấn cơ sở dữ liệu
      this.cache.set(id, user);
      this.logger.debug?.(`User ${id} cached`);

      // Bước 5: Trả về dữ liệu người dùng
      return user;
    } catch (error) {
      // Ném lại NotFoundException nếu đã có
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Ghi nhật ký lỗi truy vấn cơ sở dữ liệu
      this.logger.error(`Failed to find user by ID: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    }
  }

  /**
   * Cập nhật role của user
   *
   * Security Features:
   * - Transaction-based updates
   * - Business rule validation
   * - Admin protection logic
   * - Cache invalidation
   *
   * Business Rules:
   * - Không được downgrade admin cuối cùng
   * - Role validation (admin/user)
   * - Atomic operations
   *
   * Transaction Flow:
   * 1. Start transaction
   * 2. Validate business rules
   * 3. Update user role
   * 4. Commit or rollback
   * 5. Update cache
   *
   * Error Handling:
   * - NotFoundException: User không tồn tại
   * - ConflictException: Business rule violation
   * - Transaction errors: Database issues
   *
   * Logging:
   * - Debug: Role update start
   * - Warn: Business rule violations
   * - Log: Successful updates
   * - Error: Transaction failures
   *
   * @param id - ID của user cần cập nhật role
   * @param dto - DTO chứa role mới (UpdateRoleDto)
   * @returns Promise<UsersEntity> - User đã được cập nhật role
   *
   * @example
   * const updatedUser = await userService.updateRole(123, { role: 'admin' });
   * // Thực hiện trong giao dịch
   * // Xác thực quy tắc nghiệp vụ
   * // Cập nhật cơ sở dữ liệu
   * // Cập nhật bộ nhớ đệm
   */
  async updateRole(id: number, dto: UpdateRoleDto): Promise<UsersEntity> {
    // Bước 1: Sử dụng giao dịch để đảm bảo tính nhất quán của dữ liệu
    // Giao dịch đảm bảo tất cả hoạt động thành công hoặc hoàn tác
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Ghi nhật ký bắt đầu cập nhật vai trò
      this.logger.debug?.(`Updating role for user ${id} to ${dto.role}`);

      // Bước 2: Tìm người dùng theo ID (sẽ ném NotFoundException nếu không tìm thấy)
      // Sử dụng findById để có lợi ích bộ nhớ đệm
      const user = await this.findById(id);

      // Bước 3: Kiểm tra xem có đang hạ cấp quản trị viên cuối cùng không
      // Quy tắc nghiệp vụ: Không được để hệ thống không có quản trị viên nào
      if (user.role === ADMIN_ROLE && dto.role !== ADMIN_ROLE) {
        // Đếm số quản trị viên hiện tại trong cơ sở dữ liệu
        const adminCount = await queryRunner.manager.count(UsersEntity, {
          where: { role: ADMIN_ROLE },
        });
        // Nếu chỉ còn 1 quản trị viên và đang hạ cấp thì ném lỗi
        if (adminCount <= 1) {
          this.logger.warn(`Cannot downgrade last admin user: ${id}`);
          throw new ConflictException('Cannot downgrade the last admin user');
        }
      }

      // Bước 4: Cập nhật vai trò mới
      user.role = dto.role;

      // Bước 5: Lưu thay đổi vào cơ sở dữ liệu trong giao dịch
      // Sử dụng queryRunner.manager để thực hiện trong ngữ cảnh giao dịch
      const updatedUser = await queryRunner.manager.save(UsersEntity, user);

      // Bước 6: Commit giao dịch
      // Tất cả thay đổi được lưu vào cơ sở dữ liệu
      await queryRunner.commitTransaction();

      // Bước 7: Cập nhật bộ nhớ đệm với thông tin mới
      // Đảm bảo bộ nhớ đệm có dữ liệu mới nhất
      this.cache.set(id, updatedUser);

      // Ghi nhật ký thành công
      this.logger.log(`Role updated successfully for user ${id}: ${dto.role}`);
      return updatedUser;
    } catch (error) {
      //  Hoàn tác giao dịch nếu có lỗi
      // Đảm bảo tính nhất quán cơ sở dữ liệu
      await queryRunner.rollbackTransaction();

      // Ném lại các exception cụ thể
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      // Ghi nhật ký lỗi giao dịch
      this.logger.error(`Failed to update role: ${(error as Error).message}`, (error as Error).stack);
      // ExceptionFilter sẽ tự động xử lý lỗi
      throw error;
    } finally {
      // Đảm bảo giải phóng query runner
      // Dọn dẹp tài nguyên
      await queryRunner.release();
    }
  }

  /**
   * Xóa người dùng khỏi bộ nhớ đệm
   *
   * Quản lý bộ nhớ đệm:
   * - Vô hiệu hóa bộ nhớ đệm người dùng cụ thể
   * - Đảm bảo tính nhất quán dữ liệu
   * - Kiểm soát bộ nhớ đệm thủ công
   *
   *  Trường hợp sử dụng:
   * - Dữ liệu người dùng được cập nhật
   * - Người dùng bị xóa
   * - Bộ nhớ đệm bị hỏng
   * - Quản lý bộ nhớ
   *
   * Ghi nhật ký:
   * - Debug: Xóa bộ nhớ đệm
   *
   * @param id - ID của người dùng cần xóa khỏi bộ nhớ đệm
   *
   * @example
   * userService.clearCache(123);
   * // Lần sau findById(123) sẽ truy vấn cơ sở dữ liệu thay vì dùng bộ nhớ đệm
   */
  clearCache(id: number): void {
    // Xóa người dùng khỏi bộ nhớ đệm
    this.cache.delete(id);
    // Ghi nhật ký xóa bộ nhớ đệm
    this.logger.debug?.(`User ${id} removed from cache`);
  }

  /**
   * Xóa toàn bộ bộ nhớ đệm
   *
   * Quản lý bộ nhớ đệm:
   * - Xóa tất cả người dùng được lưu trong bộ nhớ đệm
   * - Buộc tải dữ liệu mới
   * - Dọn dẹp bộ nhớ
   *
   *  Trường hợp sử dụng:
   * - Bảo trì hệ thống
   * - Bộ nhớ đệm bị hỏng
   * - Áp lực bộ nhớ
   * - Di chuyển dữ liệu
   *
   *  Tác động hiệu suất:
   * - Các truy vấn tiếp theo sẽ chậm hơn (không có bộ nhớ đệm)
   * - Tải cơ sở dữ liệu tăng
   * - Sử dụng bộ nhớ giảm
   *
   * Ghi nhật ký:
   * - Debug: Xóa bộ nhớ đệm
   *
   * @example
   * userService.clearAllCache();
   * // Tất cả findById() calls sẽ truy vấn cơ sở dữ liệu
   */
  clearAllCache(): void {
    // Xóa toàn bộ bộ nhớ đệm
    this.cache.clear();
    // Ghi nhật ký xóa bộ nhớ đệm
    this.logger.debug?.('All user cache cleared');
  }
}
