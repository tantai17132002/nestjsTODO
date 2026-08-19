# Backend Specification — Todo App API

> Phiên bản: 1.0  
> Phạm vi: thư mục `nestjsToDo/`  
> Spec chung tham chiếu: `../project-spec.md`  
> Trạng thái: đặc tả đích, được xây dựng từ yêu cầu chung và code hiện tại.

## 1. Mục đích và nguyên tắc

Backend cung cấp REST API cho xác thực, quản lý người dùng và quản lý todo. Tài liệu này mô tả chi tiết cách backend phải triển khai hợp đồng chung trong `project-spec.md`.

Thứ tự ưu tiên khi có mâu thuẫn:

1. Hợp đồng tích hợp frontend–backend trong `project-spec.md`.
2. Yêu cầu backend trong tài liệu này.
3. Code hiện tại.

Không tự thay đổi endpoint, tên trường hoặc response công khai trong riêng backend. Thay đổi phá vỡ tương thích phải cập nhật spec chung và phối hợp với frontend.

## 2. Phạm vi

### 2.1. Trong phạm vi MVP

- Đăng ký, đăng nhập và lấy người dùng hiện tại.
- JWT authentication.
- Phân quyền `user` và `admin`.
- Danh sách, chi tiết và cập nhật role user.
- CRUD todo theo quyền sở hữu.
- Phân trang, lọc, tìm kiếm và sắp xếp todo.
- Validation request.
- Chuẩn hóa response lỗi.
- PostgreSQL, TypeORM và migration.
- Swagger/OpenAPI.
- Logging không chứa dữ liệu nhạy cảm.
- Unit test và E2E test cho các luồng quan trọng.

### 2.2. Ngoài phạm vi

- Refresh token và token revocation.
- OAuth/social login.
- Quên hoặc đặt lại mật khẩu.
- Xóa tài khoản qua API.
- Upload avatar.
- WebSocket/realtime.
- Các tính năng UI của frontend.

## 3. Công nghệ và runtime

- Node.js 20 trở lên.
- NestJS 11.
- TypeScript.
- PostgreSQL 16.
- TypeORM 0.3.
- Passport JWT.
- `bcryptjs`.
- `class-validator`, `class-transformer`.
- Swagger/OpenAPI.
- Jest và Supertest.

### 3.1. Scripts

| Script | Mục đích |
| --- | --- |
| `npm run start` | Chạy NestJS |
| `npm run start:dev` | Chạy development với watch |
| `npm run start:debug` | Chạy debug với watch |
| `npm run build` | Build TypeScript và resolve path alias |
| `npm run start:prod` | Chạy bản build trong `dist/` |
| `npm run lint` | Kiểm tra và sửa ESLint |
| `npm run format` | Format source/test bằng Prettier |
| `npm run test` | Unit test |
| `npm run test:e2e` | E2E test |
| `npm run test:cov` | Test coverage |
| `npm run migration:generate` | Sinh migration từ thay đổi entity |
| `npm run migration:create` | Tạo migration rỗng |
| `npm run migration:run` | Chạy migration chưa áp dụng |
| `npm run migration:revert` | Hoàn tác migration gần nhất |
| `npm run migration:show` | Xem trạng thái migration |
| `npm run seed:admin` | Tạo admin ban đầu |

## 4. Kiến trúc source

```text
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── constants/
│   ├── decorators/
│   ├── dto/
│   ├── entities/
│   ├── filters/
│   ├── guards/
│   ├── logger/
│   └── types/
├── config/
│   ├── typeorm.config.ts
│   └── data-source.ts
├── migrations/
├── modules/
│   ├── auth/
│   │   ├── decorators/
│   │   ├── dto/
│   │   ├── guards/
│   │   └── strategies/
│   ├── users/
│   │   ├── dto/
│   │   └── entity/
│   └── todos/
│       ├── dto/
│       └── entities/
└── scripts/
    └── create-admin.ts
```

### 4.1. Trách nhiệm module

- `AuthModule`: register, login, JWT signing/verification và current user.
- `UserModule`: persistence user, truy vấn user, phân trang và cập nhật role.
- `TodosModule`: CRUD, quyền sở hữu, pagination/filter/search/sort.
- `common`: thành phần dùng chung, không chứa business logic riêng của module.
- `config`: cấu hình database và TypeORM CLI.
- `scripts`: tác vụ vận hành độc lập như seed admin.

Controller chỉ xử lý HTTP I/O, decorator và gọi service. Business rule, authorization theo dữ liệu và transaction nằm trong service hoặc policy chuyên trách.

## 5. Bootstrap ứng dụng

Ứng dụng phải cấu hình tại `main.ts`:

- Global `ValidationPipe`.
- Global exception filter.
- CORS.
- Swagger.
- Custom logger hoặc logger tương đương.
- Port từ `PORT`, mặc định `3001`.

Global validation:

```ts
{
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true
  }
}
```

Không có global API prefix trong phiên bản hiện tại. Swagger UI ở `/api`.

## 6. Mô hình dữ liệu

Tên field công khai sử dụng `camelCase`.

### 6.1. Base entity

| Field | Kiểu | Quy tắc |
| --- | --- | --- |
| `createdAt` | timestamp | Tự động tạo |
| `updatedAt` | timestamp | Tự động cập nhật |

### 6.2. User entity

Table: `users`.

| Field | Kiểu | Quy tắc |
| --- | --- | --- |
| `id` | number | Primary key, tự tăng |
| `username` | varchar | Bắt buộc, unique |
| `email` | varchar | Bắt buộc, unique |
| `password` | varchar | Bcrypt hash, không bao giờ xuất hiện trong response |
| `role` | enum | `"user"` hoặc `"admin"`, mặc định `"user"` |
| `createdAt` | timestamp | Tự động tạo |
| `updatedAt` | timestamp | Tự động cập nhật |

### 6.3. Todo entity

Table: `todos`.

| Field | Kiểu | Quy tắc |
| --- | --- | --- |
| `id` | number | Primary key, tự tăng |
| `title` | varchar | Bắt buộc |
| `description` | varchar hoặc null | Tùy chọn |
| `isDone` | boolean | Mặc định `false` |
| `ownerId` | number | FK tới `users.id`, có index |
| `createdAt` | timestamp | Tự động tạo |
| `updatedAt` | timestamp | Tự động cập nhật |

Quan hệ:

- `User 1 — N Todo`.
- `Todo.ownerId` tham chiếu `User.id`.
- Xóa user sẽ xóa todo liên quan bằng `ON DELETE CASCADE`.

## 7. Authentication và authorization

### 7.1. JWT

Token được lấy từ:

```http
Authorization: Bearer <access_token>
```

Payload:

```json
{
  "sub": 1,
  "username": "john_doe",
  "role": "user",
  "iat": 0,
  "exp": 0
}
```

- `sub` ánh xạ thành `request.user.id`.
- `JWT_SECRET` bắt buộc có khi khởi động.
- Thời hạn lấy từ `JWT_EXPIRES_IN`, mặc định `1d`.
- Không log token.
- Thay đổi role phải có hiệu lực theo chính sách phiên đã thống nhất. Với access token chứa role, token cũ có thể giữ role cũ đến khi hết hạn; backend cần tài liệu hóa hoặc kiểm tra lại user ở các thao tác nhạy cảm.

### 7.2. Guard và decorator

- `JwtAuthGuard`: xác thực token.
- `RolesGuard`: kiểm tra role metadata theo hierarchy; `admin` đáp ứng yêu cầu của role `user`.
- `SelfOrAdminGuard`: cho phép admin hoặc user có ID trùng path param.
- `@Auth(...roles)`: kết hợp Bearer docs, JWT guard, roles guard.
- `@CurrentUser()`: lấy `JwtUser` từ request.

### 7.3. Ma trận quyền

| Endpoint | Public | User | Admin |
| --- | --- | --- | --- |
| `POST /auth/register` | Có | Có | Có |
| `POST /auth/login` | Có | Có | Có |
| `GET /auth/me` | Không | Có | Có |
| `GET /users` | Không | Không | Có |
| `GET /users/:id` | Không | Chính mình | Mọi user |
| `PATCH /users/:id/role` | Không | Không | Có |
| `POST /todos` | Không | Có | Có |
| `GET /todos` | Không | Todo của mình | Tất cả |
| `GET/PATCH/DELETE /todos/:id` | Không | Todo của mình | Tất cả |

`ownerId` luôn lấy từ JWT khi tạo todo. Client không được truyền hoặc thay đổi `ownerId`.

## 8. API contract chi tiết

### 8.1. Quy ước

- Request/response dùng JSON.
- ID trên path phải là số nguyên.
- Datetime trả về theo ISO 8601.
- Response thành công hiện không dùng envelope toàn cục.
- `access_token` giữ tên `snake_case` để tương thích API hiện tại.
- `GET /` là endpoint mặc định hiện tại và trả chuỗi `"Hello World!"`; endpoint này không thuộc contract nghiệp vụ MVP và nên được thay bằng health check rõ nghĩa hoặc loại bỏ.

### 8.2. Auth

#### `POST /auth/register`

Public. HTTP `201`.

Request:

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Validation:

- `username`: bắt buộc, không rỗng.
- `email`: bắt buộc, đúng định dạng.
- `password`: tối thiểu 8 ký tự.
- Field ngoài DTO bị từ chối.
- Client không được truyền `role`.

Response:

```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user",
    "createdAt": "2026-07-31T00:00:00.000Z",
    "updatedAt": "2026-07-31T00:00:00.000Z"
  }
}
```

Business rule:

- Username và email duy nhất.
- Password hash bằng bcrypt với 10 salt rounds.
- User mới luôn có role `user`.
- Trả `409` nếu username hoặc email đã tồn tại.

#### `POST /auth/login`

Public. HTTP `200`.

Request:

```json
{
  "usernameOrEmail": "john_doe",
  "password": "password123"
}
```

Validation:

- Hai field bắt buộc.
- Password tối thiểu 8 ký tự.

Response:

```json
{
  "access_token": "<jwt>"
}
```

Đăng nhập thất bại phải trả một thông báo `401` chung, không tiết lộ username/email có tồn tại hay password sai.

#### `GET /auth/me`

Yêu cầu JWT. HTTP `200`.

Response:

```json
{
  "id": 1,
  "username": "john_doe",
  "role": "user"
}
```

Response lấy `id`, `username`, `role` hiện tại từ database sau khi JWT hợp lệ, không chứa email/timestamps. Role vừa đổi có hiệu lực ngay mà không cần đợi token hết hạn.

### 8.3. Users

#### `GET /users`

Admin only. HTTP `200`.

Query:

| Param | Kiểu | Mặc định | Quy tắc |
| --- | --- | --- | --- |
| `page` | integer | `1` | Tối thiểu 1 |
| `limit` | integer | `10` | Từ 1 đến 100 |

Response:

```json
{
  "users": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

- Sắp xếp `createdAt DESC`.
- Mỗi phần tử tuân theo public user shape và không chứa password.
- `search` và `role` filter chưa thuộc contract hiện tại.

#### `GET /users/:id`

JWT; admin hoặc chính chủ. HTTP `200`.

- `id` được validate bằng `ParseIntPipe`.
- Trả `404` nếu user không tồn tại.
- Response là public user shape, tuyệt đối không chứa password.

#### `PATCH /users/:id/role`

Admin only. HTTP `200`.

Request:

```json
{
  "role": "admin"
}
```

- Role chỉ nhận `user` hoặc `admin`.
- Cập nhật trong transaction.
- Không cho hạ cấp admin cuối cùng; trả `409`.
- Response là public user shape.

### 8.4. Todos

#### `POST /todos`

JWT. HTTP `201`.

Request:

```json
{
  "title": "Learn NestJS",
  "description": "Read module and guard documentation",
  "isDone": false
}
```

Validation:

- `title`: string, bắt buộc, không rỗng.
- `description`: string, tùy chọn.
- `isDone`: boolean, tùy chọn, mặc định `false`.

Backend gán `ownerId = currentUser.id`.

#### `GET /todos`

JWT. HTTP `200`.

Query:

| Param | Kiểu | Mặc định | Quy tắc |
| --- | --- | --- | --- |
| `page` | integer | `1` | Tối thiểu 1 |
| `limit` | integer | `10` | Từ 1 đến 100 |
| `isDone` | string boolean | Không | `"true"` hoặc `"false"` |
| `search` | string | Không | Tìm một phần trong title/description |
| `dateFrom` | ISO datetime | Không | `createdAt >= dateFrom` |
| `dateTo` | ISO datetime | Không | `createdAt <= dateTo` |
| `sortBy` | enum | `createdAt` | `id`, `title`, `isDone`, `createdAt`, `updatedAt` |
| `sortOrder` | enum | `desc` | `asc` hoặc `desc` |

Response:

```json
{
  "todos": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPrevPage": false
  },
  "filters": {
    "isDone": "false",
    "search": "nest",
    "dateFrom": null,
    "dateTo": null,
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

Quy tắc kết hợp điều kiện:

```text
owner condition
AND isDone condition
AND date range condition
AND (title matches search OR description matches search)
```

- User luôn bị giới hạn bởi `ownerId = currentUser.id`, kể cả khi có filter/search.
- Admin không có owner condition.
- Search trên PostgreSQL phải không phân biệt hoa thường, dùng `ILIKE` hoặc cơ chế tương đương.
- Nếu có cả `dateFrom` và `dateTo`, phải kiểm tra `dateFrom <= dateTo`.

#### `GET /todos/:id`

JWT; owner hoặc admin. HTTP `200`.

- `404` nếu không tồn tại.
- `403` nếu tồn tại nhưng user không phải owner.
- Response là todo shape.

#### `PATCH /todos/:id`

JWT; owner hoặc admin. HTTP `200`.

Request nhận một hoặc nhiều field:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "isDone": true
}
```

- Không cho cập nhật `ownerId`, `id` hoặc timestamp.
- Body rỗng phải bị từ chối.
- Title nếu được truyền phải không rỗng.

#### `DELETE /todos/:id`

JWT; owner hoặc admin. HTTP `200`.

Response:

```json
{
  "deleted": true
}
```

Đây là hard delete.

## 9. Public response model

### 9.1. User

```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user",
  "createdAt": "2026-07-31T00:00:00.000Z",
  "updatedAt": "2026-07-31T00:00:00.000Z"
}
```

### 9.2. Todo

```json
{
  "id": 1,
  "title": "Learn NestJS",
  "description": "Read documentation",
  "isDone": false,
  "ownerId": 1,
  "createdAt": "2026-07-31T00:00:00.000Z",
  "updatedAt": "2026-07-31T00:00:00.000Z"
}
```

## 10. Error handling

Mọi lỗi đi qua global exception filter.

Shape chuẩn:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-31T00:00:00.000Z",
  "path": "/todos",
  "details": [
    {
      "field": "title",
      "message": "title should not be empty"
    }
  ],
  "requestId": "optional-request-id"
}
```

- `error`, `details`, `requestId` là tùy chọn.
- Validation error phải giữ được field và message từ `class-validator`.
- `400`: request/validation/query không hợp lệ.
- `401`: thiếu, sai, hết hạn token hoặc credential sai.
- `403`: đã xác thực nhưng không đủ quyền.
- `404`: tài nguyên không tồn tại.
- `409`: unique conflict hoặc vi phạm business rule.
- `500`: lỗi nội bộ; không trả stack trace, SQL hoặc secret.

Mapping lỗi PostgreSQL:

- `23505` → `409`.
- `23503`, `23502`, `23514` → `400`.
- Lỗi database khác → `500`.

## 11. Database và migration

- Runtime dùng PostgreSQL.
- Entity được auto-discover từ `src/**/*.entity`.
- Migration đặt trong `src/migrations/`.
- `synchronize` chỉ có thể bật ở development cục bộ; production luôn `false`.
- Thay đổi schema phải có migration thuận và nghịch.
- Không sửa migration đã được chia sẻ hoặc đã chạy ở môi trường dùng chung.
- Test migration trên database riêng trước khi production.
- SSL production hiện dùng `rejectUnauthorized: false`; môi trường production thực phải cấu hình CA khi có thể.
- Connection pool runtime tối đa 20; connection/query timeout 30 giây.

Repository hiện chưa có file migration. Trước khi coi MVP hoàn thành phải có migration tạo `users`, `todos`, enum role, indexes và foreign key.

## 12. Seed admin

`npm run seed:admin` tạo admin đầu tiên:

- Đọc `ADMIN_EMAIL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.
- Hash password bằng bcrypt.
- Idempotent theo email.
- Không in password ra log.
- Không được có credential mặc định an toàn giả trong production.
- Không được dùng `synchronize: true` trong script production; schema phải được tạo bằng migration.
- Khi chạy qua Docker, seed chỉ bắt đầu sau khi PostgreSQL thật sự ready, không chỉ sau khi container được tạo.

Business rule cập nhật role bảo đảm hệ thống luôn còn ít nhất một admin.

## 13. Cấu hình môi trường

```dotenv
NODE_ENV=development
PORT=3001

DB_HOST=localhost
DB_PORT=5432
DB_USER=
DB_PASS=
DB_NAME=

JWT_SECRET=
JWT_EXPIRES_IN=1d

FE_URL=http://localhost:3000

ADMIN_EMAIL=
ADMIN_USERNAME=
ADMIN_PASSWORD=
```

Docker seed hiện còn dùng:

```dotenv
DB_HOSTAD=postgres
DB_PORTAD=5432
```

Yêu cầu:

- Validate các biến bắt buộc ngay khi khởi động.
- `.env` không được commit.
- `.env.example` chỉ chứa tên biến và giá trị mẫu không nhạy cảm.
- Nên thống nhất seed dùng `DB_HOST`/`DB_PORT`, tránh duy trì cặp biến `DB_HOSTAD`/`DB_PORTAD` riêng.

## 14. CORS

- Cho phép request không có origin phục vụ tooling/server-to-server.
- Development có thể cho phép `http://localhost:*` và `https://localhost:*`.
- Origin ngoài localhost phải thuộc danh sách `FE_URL`, phân tách bằng dấu phẩy.
- Cho phép credentials.
- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Headers: `Content-Type`, `Authorization`, `Accept`.
- Production không được cho phép wildcard origin khi có credentials.

## 15. Logging

- Log sự kiện auth, user và todo với mức phù hợp.
- Log có timestamp, method, URL, status, user ID và request ID khi có.
- Không log password, token, secret, database credential hoặc toàn bộ Authorization header.
- Sanitize dữ liệu nhạy cảm ở mọi độ sâu trước khi log.
- Stack trace chỉ ghi server-side và phải có chính sách theo môi trường.
- Login failure dùng thông báo chung để tránh user enumeration.
- Debug log có thể tắt ở production.

## 16. Swagger

Swagger UI: `/api`.

Phải có:

- Tags `Authentication`, `Users`, `Todos`.
- Bearer scheme tên `JWT-auth` và decorator tham chiếu đúng cùng scheme.
- Request DTO, response DTO, query param và error status.
- Ví dụ request/response khớp runtime.
- Không mô tả field hoặc filter chưa được triển khai.

## 17. Cache và transaction

- `UserService.findById` hiện dùng cache `Map<number, UsersEntity>`.
- Role update phải invalidation/cập nhật cache sau commit.
- Cache không được làm trả role cũ hoặc password ra response.
- Cache in-memory không được coi là nguồn dữ liệu chung khi chạy nhiều instance.
- Nếu giữ cache này, phải có TTL/kích thước tối đa hoặc loại bỏ khi chưa cần.
- Cập nhật role dùng transaction và luôn release query runner.

## 18. Testing

### 18.1. Unit test bắt buộc

- Auth: register, login đúng/sai, JWT payload.
- User: unique conflict, pagination, self/admin, update role, không hạ cấp admin cuối.
- Todo: create owner, list owner/admin, pagination, từng filter và tổ hợp filter, CRUD authorization.
- Guard: JWT, roles và self-or-admin.
- Validation pipe và exception filter.
- Password không xuất hiện trong mọi user response.

Code hiện có unit test cho auth service, user service, todo service/controller, roles guard, self-or-admin guard, validation pipe và root controller. Các test này phải được duy trì khi sửa contract hoặc security gap.

### 18.2. E2E test bắt buộc

- Register → login → me.
- User A CRUD todo của mình.
- User B không đọc/sửa/xóa todo của A.
- Search/filter không làm user thấy todo của người khác.
- Admin đọc/sửa/xóa todo của user.
- User không gọi được API admin.
- Admin list user và đổi role.
- Validation, `401`, `403`, `404`, `409`.
- Response shape đúng spec.

E2E hiện tại chỉ kiểm tra `GET /` trả `"Hello World!"`; chưa đủ tiêu chí MVP.

## 19. Tiêu chí hoàn thành backend

- `npm run build`, `npm run lint`, `npm run test`, `npm run test:e2e` thành công.
- Tất cả endpoint và response khớp spec chung.
- Authorization không thể bị bypass khi kết hợp filter.
- Không response nào chứa password/hash.
- Credential sai trả lỗi chung, không hỗ trợ user enumeration.
- Validation lỗi trả chi tiết field đúng.
- Migration chạy được trên database rỗng và revert được.
- Production không dùng schema synchronization.
- Seed admin an toàn và idempotent.
- Swagger khớp runtime.
- CORS chỉ cho origin được cấu hình.

## 20. Khoảng cách đã xử lý

Các khoảng cách implementation so với spec đã được xử lý trong code:

1. Query todo ghép `owner AND filters AND (title OR description)`, không còn OR làm bypass owner.
2. Search không phân biệt hoa thường bằng `LOWER(...) LIKE LOWER(...)` (tương đương ILIKE trên PostgreSQL).
3. API user map sang DTO công khai, không phụ thuộc `@Exclude()`.
4. Login thất bại dùng một thông báo 401 chung.
5. Exception filter giữ `details` validation theo hợp đồng.
6. Body cập nhật todo rỗng và title rỗng bị từ chối; `dateFrom <= dateTo` được validate.
7. `JWT_EXPIRES_IN` đọc từ môi trường, mặc định `1d`.
8. JWT strategy đọc lại user/role từ database.
9. Seed admin không còn credential fallback hay `synchronize: true`.
10. Có migration khởi tạo `users`, `todos`, enum, index và FK cascade.
11. E2E bao gồm auth, CRUD, cô lập owner, admin và mã lỗi.
12. Cache user có TTL và giới hạn kích thước.
13. `.env.example` mô tả `NODE_ENV`, `FE_URL` và thống nhất biến database.
14. Email được trim/lowercase trước khi unique, lưu và đăng nhập.
15. Swagger dùng scheme `JWT-auth`; README trỏ Swagger tới port `3001`.
16. `GET /health` thay cho `GET /` Hello World.
17. CORS production chỉ cho origin từ `FE_URL`; Docker seed chờ PostgreSQL healthy.
