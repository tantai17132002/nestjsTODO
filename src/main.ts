import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { CustomLogger } from '@/common/logger/custom-logger.service';
import { flattenValidationErrors } from '@/common/utils/validation-details';

/**
 * Khởi tạo NestJS: validation toàn cục, CORS, Swagger, logger và exception filter.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger(),
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = process.env.FE_URL
    ? process.env.FE_URL.split(',')
        .map((url) => url.trim())
        .filter(Boolean)
    : [];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalhost =
        origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:');

      if (!isProduction && isLocalhost) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          message: 'Validation failed',
          error: 'Bad Request',
          details: flattenValidationErrors(errors),
        }),
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Todo API')
    .setDescription('NestJS Todo App with Auth')
    .setVersion('1.0')
    .addTag('Authentication', 'User registration and authentication endpoints')
    .addTag('Todos', 'Todo management with pagination, filtering and sorting')
    .addTag('Users', 'User management and role updates (Admin only)')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
