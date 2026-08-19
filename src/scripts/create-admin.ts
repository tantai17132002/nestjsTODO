#!/usr/bin/env ts-node
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { hash } from 'bcryptjs';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { normalizeEmail } from '@/common/utils/normalize';

dotenv.config();

/**
 * DataSource cho script seed; không synchronize schema — phải chạy migration trước.
 */
function createDataSourceConfig(): DataSourceOptions {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'] as const;
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    entities: [UsersEntity, TodoEntity],
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
  };
}

/**
 * Tạo admin đầu tiên, idempotent theo email đã chuẩn hóa. Không in mật khẩu.
 */
async function main(): Promise<void> {
  const emailRaw = process.env.ADMIN_EMAIL;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!emailRaw || !username || !password) {
    throw new Error('ADMIN_EMAIL, ADMIN_USERNAME and ADMIN_PASSWORD are required');
  }

  const email = normalizeEmail(emailRaw);
  const dataSource = new DataSource(createDataSourceConfig());

  try {
    await dataSource.initialize();
    const repository = dataSource.getRepository(UsersEntity);

    const existingAdmin = await repository.findOne({ where: { email } });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      return;
    }

    console.log('Creating admin user with email:', email);

    const adminUser = repository.create({
      username,
      email,
      password: await hash(password, 10),
      role: 'admin',
    });
    await repository.save(adminUser);
    console.log('Admin user created successfully:', adminUser.email);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error: unknown) => {
  console.error('Error creating admin user:', error instanceof Error ? error.message : error);
  process.exit(1);
});
