import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration khởi tạo bảng users, todos, enum role, index ownerId và khóa ngoại cascade.
 * Idempotent để nhận database đã có schema từ synchronize cũ.
 */
export class InitSchema1755570000000 implements MigrationInterface {
  name = 'InitSchema1755570000000';

  /**
   * Tạo schema ban đầu; bỏ qua object đã tồn tại.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "users_role_enum" AS ENUM('user', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL NOT NULL,
        "username" character varying NOT NULL,
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'user',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "todos" (
        "id" SERIAL NOT NULL,
        "title" character varying NOT NULL,
        "description" character varying,
        "isDone" boolean NOT NULL DEFAULT false,
        "ownerId" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_todos_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_todos_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_todos_ownerId" ON "todos" ("ownerId")`);
  }

  /**
   * Hoàn tác schema về trạng thái trống.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_todos_ownerId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "todos"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
