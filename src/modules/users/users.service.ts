import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { Repository, DataSource } from 'typeorm';
import { CreateUsersDto } from '@/modules/users/dto/create-users.dto';
import * as bcrypt from 'bcryptjs';
import { UpdateRoleDto } from '@/modules/users/dto/update-role.dto';
import { QueryUserDto } from '@/modules/users/dto/query-user.dto';
import { UserResponseDto } from '@/modules/users/dto/user-response.dto';
import { UserPaginationResponseDto } from '@/modules/users/dto/user-pagination-response.dto';
import { ADMIN_ROLE } from '@/common/constants/roles.constant';
import { CustomLogger } from '@/common/logger/custom-logger.service';
import { toPublicUser } from '@/modules/users/mappers/user.mapper';
import { normalizeEmail } from '@/common/utils/normalize';

const BCRYPT_SALT_ROUNDS = 10;
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_SIZE = 200;

type CacheEntry = {
  user: UsersEntity;
  expiresAt: number;
};

/**
 * Quản lý user: tạo tài khoản, truy vấn công khai, cập nhật role và bảo vệ admin cuối cùng.
 */
@Injectable()
export class UserService {
  /**
   * Cache nội bộ có TTL và giới hạn kích thước; không dùng làm nguồn phân quyền đa instance.
   */
  private readonly cache = new Map<number, CacheEntry>();

  constructor(
    @InjectRepository(UsersEntity)
    private usersRepository: Repository<UsersEntity>,
    private dataSource: DataSource,
    private readonly logger: CustomLogger,
  ) {}

  /**
   * Tạo user mới với role `user`, hash mật khẩu và chuẩn hóa email.
   *
   * @param createUserDto username, email, password từ client.
   * @returns User công khai, không gồm password.
   * @throws ConflictException khi username hoặc email đã tồn tại.
   */
  async createUser(createUserDto: CreateUsersDto): Promise<UserResponseDto> {
    const username = createUserDto.username.trim();
    const email = normalizeEmail(createUserDto.email);

    this.logger.debug?.(`Creating new user: ${username}`);

    const existingUser = await this.findByUsername(username);
    if (existingUser) {
      this.logger.warn(`Username already exists: ${username}`);
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.findByEmail(email);
    if (existingEmail) {
      this.logger.warn(`Email already exists: ${email}`);
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
    });
    const savedUser = await this.usersRepository.save(user);

    this.logger.log(`User created successfully: ${username}`);
    return toPublicUser(savedUser);
  }

  /**
   * Tìm user theo username, gồm hash mật khẩu — chỉ dùng cho xác thực nội bộ.
   *
   * @param username Tên đăng nhập đã trim.
   * @returns Entity hoặc null.
   */
  async findByUsername(username: string): Promise<UsersEntity | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  /**
   * Tìm user theo email đã chuẩn hóa, gồm hash mật khẩu — chỉ dùng nội bộ.
   *
   * @param email Email; sẽ được lowercase trước khi truy vấn.
   * @returns Entity hoặc null.
   */
  async findByEmail(email: string): Promise<UsersEntity | null> {
    return this.usersRepository.findOne({ where: { email: normalizeEmail(email) } });
  }

  /**
   * Tìm user theo username hoặc email để đăng nhập.
   *
   * @param usernameOrEmail Giá trị client gửi; email được lowercase.
   * @returns Entity gồm password hoặc null.
   */
  async findByUsernameOrEmail(usernameOrEmail: string): Promise<UsersEntity | null> {
    const identifier = usernameOrEmail.trim();
    return this.usersRepository.findOne({
      where: [{ username: identifier }, { email: normalizeEmail(identifier) }],
    });
  }

  /**
   * Danh sách user công khai, sắp xếp createdAt DESC, chỉ dành cho admin.
   *
   * @param query page/limit theo hợp đồng.
   * @returns users và pagination; không chứa password.
   */
  async findAll(query?: QueryUserDto): Promise<UserPaginationResponseDto> {
    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 10));
    const skip = (page - 1) * limit;

    const [users, total] = await this.usersRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    this.logger.debug?.(`Retrieved ${users.length} users (page ${page}/${totalPages || 1})`);

    return {
      users: users.map(toPublicUser),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Lấy entity theo ID, có cache TTL. Dùng nội bộ (auth/role); không trả ra API.
   *
   * @param id ID user.
   * @returns Entity gồm password hash.
   * @throws NotFoundException nếu không tồn tại.
   */
  async findEntityById(id: number): Promise<UsersEntity> {
    const cached = this.getCachedUser(id);
    if (cached) {
      return cached;
    }

    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      this.logger.warn(`User not found: ${id}`);
      throw new NotFoundException('User not found');
    }

    this.setCachedUser(id, user);
    return user;
  }

  /**
   * Chi tiết user công khai cho GET /users/:id.
   *
   * @param id ID user.
   * @returns User không chứa password.
   */
  async findById(id: number): Promise<UserResponseDto> {
    const user = await this.findEntityById(id);
    return toPublicUser(user);
  }

  /**
   * Cập nhật role trong transaction; không hạ cấp admin cuối cùng.
   *
   * @param id ID user cần đổi role.
   * @param dto role mới `user` hoặc `admin`.
   * @returns User công khai sau cập nhật.
   * @throws ConflictException khi hạ cấp admin cuối.
   */
  async updateRole(id: number, dto: UpdateRoleDto): Promise<UserResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.debug?.(`Updating role for user ${id} to ${dto.role}`);

      const user = await queryRunner.manager.findOne(UsersEntity, { where: { id } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.role === ADMIN_ROLE && dto.role !== ADMIN_ROLE) {
        const adminCount = await queryRunner.manager.count(UsersEntity, {
          where: { role: ADMIN_ROLE },
        });
        if (adminCount <= 1) {
          this.logger.warn(`Cannot downgrade last admin user: ${id}`);
          throw new ConflictException('Cannot downgrade the last admin user');
        }
      }

      user.role = dto.role;
      const updatedUser = await queryRunner.manager.save(UsersEntity, user);
      await queryRunner.commitTransaction();

      this.setCachedUser(id, updatedUser);
      this.logger.log(`Role updated successfully for user ${id}: ${dto.role}`);
      return toPublicUser(updatedUser);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Xóa một user khỏi cache sau khi dữ liệu thay đổi.
   *
   * @param id ID user.
   */
  clearCache(id: number): void {
    this.cache.delete(id);
  }

  /**
   * Xóa toàn bộ cache user.
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Đọc cache nếu chưa hết TTL.
   */
  private getCachedUser(id: number): UsersEntity | undefined {
    const entry = this.cache.get(id);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(id);
      return undefined;
    }
    return entry.user;
  }

  /**
   * Ghi cache với TTL; loại bản cũ nhất khi vượt giới hạn kích thước.
   */
  private setCachedUser(id: number, user: UsersEntity): void {
    if (this.cache.size >= CACHE_MAX_SIZE && !this.cache.has(id)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(id, { user, expiresAt: Date.now() + CACHE_TTL_MS });
  }
}
