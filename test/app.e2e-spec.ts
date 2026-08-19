import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import { ValidationError } from 'class-validator';
import { AuthModule } from '@/modules/auth/auth.module';
import { UserModule } from '@/modules/users/users.module';
import { TodosModule } from '@/modules/todos/todos.module';
import { UsersEntity } from '@/modules/users/entity/users.entity';
import { TodoEntity } from '@/modules/todos/entities/todo.entity';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { flattenValidationErrors } from '@/common/utils/validation-details';
import { UserService } from '@/modules/users/users.service';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';

/**
 * E2E theo hợp đồng API: auth, CRUD todo, cô lập owner, admin và mã lỗi.
 */
describe('Todo API (e2e)', () => {
  let app: INestApplication;
  let userService: UserService;

  const password = 'password123';

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.NODE_ENV = 'test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'e2e-secret',
              JWT_EXPIRES_IN: '1h',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [UsersEntity, TodoEntity],
          synchronize: true,
          dropSchema: true,
          retryAttempts: 0,
        }),
        AuthModule,
        UserModule,
        TodosModule,
      ],
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: (errors: ValidationError[]) =>
          new BadRequestException({
            message: 'Validation failed',
            error: 'Bad Request',
            details: flattenValidationErrors(errors),
          }),
      }),
    );
    userService = moduleFixture.get(UserService);
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function registerAndLogin(username: string, email: string) {
    const register = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username, email, password })
      .expect(201);

    expect(register.body.user).not.toHaveProperty('password');

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail: username, password })
      .expect(200);

    return { token: login.body.access_token as string, user: register.body.user };
  }

  it('GET /health returns ok', async () => {
    await request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('register → login → me', async () => {
    const { token, user } = await registerAndLogin('alice', 'alice@example.com');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body).toEqual({
      id: user.id,
      username: 'alice',
      role: 'user',
    });
  });

  it('returns the same 401 message for unknown user and wrong password', async () => {
    await registerAndLogin('bob', 'bob@example.com');

    const unknown = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail: 'nobody', password })
      .expect(401);

    const wrong = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail: 'bob', password: 'wrongpass' })
      .expect(401);

    expect(unknown.body.message).toBe(wrong.body.message);
    expect(unknown.body.statusCode).toBe(401);
  });

  it('user can CRUD own todos and cannot access another user todo', async () => {
    const userA = await registerAndLogin('user_a', 'a@example.com');
    const userB = await registerAndLogin('user_b', 'b@example.com');

    const created = await request(app.getHttpServer())
      .post('/todos')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ title: 'A secret todo', description: 'private' })
      .expect(201);

    expect(created.body.ownerId).toBe(userA.user.id);
    expect(created.body).not.toHaveProperty('password');

    await request(app.getHttpServer())
      .get(`/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(403);

    const listB = await request(app.getHttpServer())
      .get('/todos?search=secret')
      .set('Authorization', `Bearer ${userB.token}`)
      .expect(200);

    expect(listB.body.todos).toHaveLength(0);

    await request(app.getHttpServer())
      .patch(`/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ isDone: true })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200)
      .expect({ deleted: true });
  });

  it('rejects empty todo update and invalid date range', async () => {
    const { token } = await registerAndLogin('carol', 'carol@example.com');
    const created = await request(app.getHttpServer())
      .post('/todos')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Range todo' })
      .expect(201);

    const empty = await request(app.getHttpServer())
      .patch(`/todos/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(empty.body.statusCode).toBe(400);
    expect(empty.body.message).toBe('At least one field must be provided');

    await request(app.getHttpServer())
      .get('/todos?dateFrom=2024-12-31T00:00:00.000Z&dateTo=2024-01-01T00:00:00.000Z')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('admin can list users, change role, and access all todos', async () => {
    const admin = await registerAndLogin('admin_e2e', 'admin.e2e@example.com');
    await userService.updateRole(admin.user.id, { role: 'admin' });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usernameOrEmail: 'admin_e2e', password })
      .expect(200);
    const adminToken = adminLogin.body.access_token as string;

    const regular = await registerAndLogin('dave', 'dave@example.com');
    const todo = await request(app.getHttpServer())
      .post('/todos')
      .set('Authorization', `Bearer ${regular.token}`)
      .send({ title: 'Dave todo' })
      .expect(201);

    const users = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(users.body.users.every((item: { password?: string }) => !item.password)).toBe(true);

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${regular.token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/todos/${todo.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'dave', email: 'other@example.com', password })
      .expect(409);
  });
});
