import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load biến môi trường từ .env
config();

/**
 * DataSource dùng cho TypeORM CLI khi generate/run/revert migration.
 * Script npm phải đăng ký tsconfig-paths để resolve alias `@/`.
 */
export default new DataSource({
  type: 'postgres',

  // Đọc trực tiếp từ process.env (không dùng ConfigService)
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  // CLI chạy qua ts-node nên chỉ load source; tránh trùng migration với dist.
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],

  // KHÔNG BAO GIỜ dùng synchronize = true trong CLI
  // Luôn dùng migrations để quản lý schema
  synchronize: false,

  // Cấu hình logging cho CLI
  // Log các truy vấn SQL khi chạy migrations
  logging: true,

  // Cấu hình SSL cho production (nếu cần)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

  // Cấu hình connection pool cho CLI
  extra: {
    // Số lượng connection tối đa trong pool
    max: 10,
    // Thời gian timeout cho connection (ms)
    connectionTimeoutMillis: 30000,
    // Thời gian timeout cho query (ms)
    queryTimeoutMillis: 30000,
  },
});
