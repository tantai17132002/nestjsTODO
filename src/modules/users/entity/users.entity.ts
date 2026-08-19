// Import các decorator cần thiết từ TypeORM và class-transformer
import { Column, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { BaseEntity } from '@/common/entities/base.entity';

/**
 * User Entity - Đại diện cho bảng users trong database
 *
 * Entity này định nghĩa cấu trúc dữ liệu của user trong hệ thống
 * Sử dụng TypeORM decorators để mapping với database
 */
@Entity('users') // Tên bảng trong database
export class UsersEntity extends BaseEntity {
  /**
   * ID của users - Tự động tăng (auto increment)
   * Đây là primary key của bảng users
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * Tên đăng nhập của users
   * unique: true = đảm bảo username không bị trùng lặp
   */
  @Column({ unique: true })
  username: string;

  /**
   * Email của users
   * Dùng để đăng nhập và liên lạc
   * unique: true = đảm bảo email không bị trùng lặp
   */
  @Column({ unique: true })
  email: string;

  /**
   * Mật khẩu đã được mã hóa của users
   * @Exclude() = ẩn field này khi trả về dữ liệu cho client
   * Đảm bảo bảo mật - không bao giờ trả password về frontend
   */
  @Column()
  @Exclude() // Ẩn khi trả dữ liệu
  password: string;

  /**
   * Vai trò `user` hoặc `admin`. PostgreSQL dùng enum; SQLite test dùng varchar.
   */
  @Column({
    type: process.env.NODE_ENV === 'test' ? 'varchar' : 'enum',
    enum: ['user', 'admin'],
    default: 'user',
  })
  role: 'user' | 'admin';

  /**
   * Quan hệ One-to-Many với TodoEntity
   * Một user có thể có nhiều todos
   * Lazy loading để tránh load dữ liệu không cần thiết
   */
  @OneToMany(() => TodoEntity, (todo) => todo.owner, { lazy: true })
  todos: Promise<TodoEntity[]>;
}
