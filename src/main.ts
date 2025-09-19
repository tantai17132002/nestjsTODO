// Import các module cần thiết từ NestJS
import { NestFactory } from '@nestjs/core'; // Factory để tạo ứng dụng NestJS
import { AppModule } from '@/app.module'; // Module chính của ứng dụng
import { ValidationPipe } from '@nestjs/common'; // Pipe để validate dữ liệu đầu vào
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'; // Module để tạo API documentation
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter'; // ExceptionFilter toàn cục
import { CustomLogger } from '@/common/logger/custom-logger.service';

/**
 * Hàm bootstrap - Khởi tạo và chạy ứng dụng NestJS
 *
 * Đây là entry point chính của ứng dụng, thực hiện các bước:
 * 1. Tạo ứng dụng NestJS từ AppModule
 * 2. Cấu hình global validation pipe
 * 3. Cấu hình Swagger documentation
 * 4. Khởi động server
 *
 * @returns Promise<void> - Không trả về giá trị
 */
async function bootstrap() {
  // Tạo instance của ứng dụng NestJS từ AppModule
  const app = await NestFactory.create(AppModule, {
    logger: new CustomLogger(),
  });

  // Cấu hình CORS để cho phép frontend gọi API từ domain khác
  // Cho phép tất cả các origin từ localhost với bất kỳ port nào
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Cho phép tất cả các request từ localhost với bất kỳ port nào
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
        callback(null, true);
      } else {
        // Nếu có FE_URL được cấu hình, kiểm tra thêm các origin đó
        const allowedOrigins = process.env.FE_URL 
          ? process.env.FE_URL.split(',').map(url => url.trim())
          : [];
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true, // true nếu frontend dùng cookie
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Cấu hình global exception filter để xử lý tất cả các exception
  app.useGlobalFilters(new HttpExceptionFilter());

  // Cấu hình global validation pipe để validate dữ liệu đầu vào
  // whitelist: true = chỉ cho phép các property được định nghĩa trong DTO, loại bỏ các field thừa
  // forbidNonWhitelisted: true = nếu có property không được định nghĩa trong DTO thì báo lỗi 400 Bad Request
  // transform: true = tự động chuyển đổi dữ liệu từ string sang number, boolean, date, ...
  // enableImplicitConversion: true = cho phép chuyển đổi ngầm định các kiểu dữ liệu

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Cấu hình Swagger/OpenAPI documentation để tạo tài liệu API tự động
  const config = new DocumentBuilder()
    .setTitle('Todo API') // Tiêu đề hiển thị trên Swagger UI
    .setDescription('NestJS Todo App with Auth') // Mô tả chi tiết về API
    .setVersion('1.0') // Phiên bản API hiện tại
    .addTag('Authentication', 'User registration and authentication endpoints')
    .addTag('Todos', 'Todo management with advanced pagination, filtering and sorting')
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
    ) // Thêm authentication Bearer token vào Swagger UI
    .build(); // Tạo cấu hình Swagger

  // Tạo document Swagger từ cấu hình đã định nghĩa ở trên
  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI tại đường dẫn /api để hiển thị tài liệu API
  // Có thể truy cập: http://localhost:3000/api để xem và test API
  SwaggerModule.setup('api', app, document);

  // Khởi động server HTTP trên port được chỉ định
  // Lấy PORT từ biến môi trường (.env), nếu không có thì dùng port 3000 làm mặc định
  await app.listen(process.env.PORT || 3001);
}

// Gọi hàm bootstrap để khởi động ứng dụng NestJS
// Đây là điểm khởi đầu của toàn bộ ứng dụng
bootstrap();
