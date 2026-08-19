# 🚀 NestJS Todo App

A modern Todo application built with NestJS, TypeORM, PostgreSQL, and JWT authentication.

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Installation](#-installation)
- [Running the Application](#-running-the-application)
- [Testing](#-testing)
- [Database Migrations](#-database-migrations)
- [API Documentation](#-api-documentation)

## ✨ Features

- 🔐 **JWT Authentication** - Secure user authentication and authorization
- 👥 **Role-based Access Control** - Admin and User roles with different permissions
- 📝 **Todo Management** - Create, read, update, and delete todos
- 👤 **User Management** - User registration, profile management
- 🗄️ **PostgreSQL Database** - Robust data persistence with TypeORM
- 🐳 **Docker Support** - Easy deployment with Docker Compose
- 📚 **API Documentation** - Swagger/OpenAPI documentation
- 🧪 **Testing** - Unit and E2E tests with Jest
- 🔄 **Database Migrations** - Version-controlled database schema changes

## 🛠 Tech Stack

- **Backend Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT with Passport
- **Validation**: Class Validator
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Containerization**: Docker & Docker Compose
- **Language**: TypeScript


## 🚀 Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

## ⚙️ Configuration

Create a `.env` file in the root directory based on `.env.example`.

## 🏃‍♂️ Running the Application

### Development Mode
```bash
# Start in development mode with hot reload
npm run start:dev

# Start in debug mode
npm run start:debug
```

### Production Mode
```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

### Using Docker
```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Generate test coverage report
npm run test:cov
```

## 🗄️ Database Migrations

This project uses TypeORM migrations to manage database schema changes.

### Creating Migrations

```bash
# Generate migration from entity changes
npm run migration:generate -- src/migrations/MigrationName

# Create empty migration file
npm run migration:create -- src/migrations/MigrationName
```

### Running Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

### Migration Best Practices

> ⚠️ **Important Notes:**
> - Never modify committed migration files
> - Always test migrations on a test database first
> - Backup your production database before running migrations
> - Migrations run in timestamp order

### Migration File Structure

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1234567890123 implements MigrationInterface {
    name = 'CreateUsersTable1234567890123'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Forward migration code
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Rollback migration code
    }
}
```

## 📚 API Documentation

Once the application is running, you can access the Swagger API documentation at:

```
http://localhost:3001/api
```

The documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Interactive API testing
