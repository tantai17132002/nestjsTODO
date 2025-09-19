#!/usr/bin/env ts-node
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { hash } from 'bcryptjs';

// Import entity từ app
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';

dotenv.config();

/**
 * Tạo cấu hình DataSource cho script độc lập
 * Tái sử dụng logic từ typeorm.config.ts nhưng phù hợp với script
 */
function createDataSourceConfig(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'postgres',
    port: +(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'project_cb',
    // Load các entity cần thiết cho script này
    entities: [UsersEntity, TodoEntity],
    synchronize: true,
    // Thêm logging để debug
    logging: process.env.NODE_ENV === 'development',
  };
}

/**
 * Script tạo admin user cho hệ thống
 * Sử dụng environment variables để cấu hình thông tin admin
 */
async function main() {
  // Sử dụng helper function để tạo cấu hình
  const dataSourceConfig = createDataSourceConfig();
  const dataSource = new DataSource(dataSourceConfig);

  try {
    // Khởi tạo kết nối database
    await dataSource.initialize();

    const repository = dataSource.getRepository(UsersEntity);
    
    // Lấy thông tin admin từ environment variables với fallback
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await repository.findOne({ where: { email } });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    console.log('Creating admin user with email:', email);

    // Băm mật khẩu với salt rounds = 10
    const hashedPassword = await hash(password, 10);

    // Tạo admin user mới
    const adminUser = repository.create({
      username,
      email,
      password: hashedPassword,
      role: 'admin',
    });

    await repository.save(adminUser);
    console.log('Admin user created successfully:', adminUser.email);

  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  } finally {
    // Đảm bảo đóng kết nối database
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Xử lý lỗi chính và thoát với code phù hợp
main().catch((error) => {
  process.exit(1);
});
