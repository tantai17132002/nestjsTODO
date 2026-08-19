# Đặc tả tổng thể — Todo App

> Phiên bản: 1.1  
> Phạm vi: yêu cầu và hợp đồng dùng chung giữa frontend và backend.

## 1. Vai trò của tài liệu

Đây là nguồn yêu cầu chung của toàn dự án. Tài liệu chỉ chứa:

- Mục tiêu sản phẩm.
- Phạm vi chức năng.
- Thuật ngữ và business rule dùng chung.
- Hợp đồng tích hợp frontend–backend.
- Tiêu chí hoàn thành toàn hệ thống.

Chi tiết triển khai theo thư mục nằm tại:

- Backend: [`nestjsToDo/BACKEND_SPEC.md`](./nestjsToDo/BACKEND_SPEC.md).
- Frontend: [`vuejsToDo/FRONTEND_SPEC.md`](./vuejsToDo/FRONTEND_SPEC.md).

Khi có mâu thuẫn về endpoint, tên field, role hoặc response công khai, tài liệu này được ưu tiên hơn spec riêng. Chi tiết nội bộ không được định nghĩa ở đây do spec của từng ứng dụng quyết định.

## 2. Tổng quan sản phẩm

Todo App là ứng dụng web quản lý công việc cá nhân:

- Người dùng đăng ký, đăng nhập và quản lý todo của mình.
- Admin quản lý người dùng và có thể thao tác mọi todo.
- Frontend giao tiếp với backend qua REST API dùng HTTP/JSON.
- Route cần xác thực gửi JWT Bearer token.

### 2.1. Mục tiêu MVP

- Hoàn chỉnh luồng đăng ký, đăng nhập, đăng xuất và xem hồ sơ.
- CRUD todo với phân trang, lọc, tìm kiếm và sắp xếp.
- Cô lập dữ liệu todo giữa các user.
- Phân quyền quản trị user và toàn bộ todo.
- Có validation, trạng thái loading/error và phản hồi dễ hiểu.
- Frontend và backend tuân theo cùng một API contract.

### 2.2. Ngoài phạm vi MVP

- Dark mode.
- Biểu đồ thống kê.
- Upload avatar.
- Đa ngôn ngữ.
- Refresh token.
- OAuth/social login.
- Quên hoặc đặt lại mật khẩu.
- Realtime/WebSocket.

## 3. Kiến trúc hệ thống

```text
Browser
  │
  ▼
NuxtJS Frontend ── HTTP/JSON + Bearer JWT ──► NestJS REST API
                                                   │
                                                   ▼
                                              PostgreSQL
```

### 3.1. Ranh giới trách nhiệm

- Frontend chịu trách nhiệm giao diện, navigation, state phía client và validation phục vụ trải nghiệm.
- Backend chịu trách nhiệm xác thực, phân quyền cuối cùng, business rule và persistence.
- Kiểm tra quyền trên frontend không thay thế kiểm tra quyền backend.
- Backend không phụ thuộc cấu trúc component/page của frontend.
- Frontend không phụ thuộc cấu trúc entity/service nội bộ của backend.

## 4. Vai trò và business rule

Hai role hợp lệ:

- `user`: người dùng thông thường.
- `admin`: quản trị viên.

| Chức năng | Khách | User | Admin |
| --- | --- | --- | --- |
| Đăng ký, đăng nhập | Có | Có | Có |
| Xem hồ sơ hiện tại | Không | Chính mình | Chính mình |
| Tạo todo | Không | Cho chính mình | Cho chính mình |
| Xem danh sách todo | Không | Todo của mình | Tất cả todo |
| Xem, sửa, xóa todo | Không | Todo của mình | Tất cả todo |
| Xem danh sách user | Không | Không | Có |
| Xem chi tiết user | Không | Chính mình | Tất cả user |
| Cập nhật role | Không | Không | Có |

Business rule:

- User đăng ký mới luôn có role `user`.
- Client không được chỉ định role khi đăng ký.
- Todo mới luôn thuộc user đang đăng nhập.
- Client không được gán hoặc thay đổi `ownerId`.
- Hệ thống phải luôn còn ít nhất một admin.
- Password và secret không được xuất hiện trong response hoặc log.

## 5. Mô hình dữ liệu trao đổi

Tên field API dùng `camelCase`, ngoại trừ `access_token` được giữ để tương thích contract hiện tại.

### 5.1. User công khai

```ts
type User = {
  id: number
  username: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}
```

`GET /auth/me` hiện trả shape rút gọn:

```ts
type CurrentUser = {
  id: number
  username: string
  role: 'user' | 'admin'
}
```

### 5.2. Todo

```ts
type Todo = {
  id: number
  title: string
  description?: string
  isDone: boolean
  ownerId: number
  createdAt: string
  updatedAt: string
}
```

### 5.3. Pagination

```ts
type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}
```

Datetime là chuỗi ISO 8601.

## 6. Authentication contract

Route cần đăng nhập sử dụng:

```http
Authorization: Bearer <access_token>
```

JWT chứa tối thiểu:

- `sub`: user ID.
- `username`: username.
- `role`: `user` hoặc `admin`.
- `iat`, `exp`: thời điểm phát hành và hết hạn.

Quy tắc client:

- Sau login, lưu token theo cơ chế an toàn được frontend spec quy định.
- Gắn token vào request cần xác thực.
- Khi nhận `401`, xóa phiên client và đưa user về login.
- Logout hiện là thao tác client-side, không có endpoint backend.

## 7. API contract

Base URL lấy từ cấu hình môi trường frontend. API hiện không dùng global prefix.

### 7.1. Endpoint tổng quan

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| POST | `/auth/register` | Public | Đăng ký |
| POST | `/auth/login` | Public | Đăng nhập |
| GET | `/auth/me` | JWT | Lấy user từ phiên hiện tại |
| GET | `/users` | Admin | Danh sách user |
| GET | `/users/:id` | Chính chủ/Admin | Chi tiết user |
| PATCH | `/users/:id/role` | Admin | Cập nhật role |
| POST | `/todos` | JWT | Tạo todo |
| GET | `/todos` | JWT | Danh sách todo |
| GET | `/todos/:id` | Owner/Admin | Chi tiết todo |
| PATCH | `/todos/:id` | Owner/Admin | Cập nhật todo |
| DELETE | `/todos/:id` | Owner/Admin | Xóa todo |

### 7.2. Auth

Đăng ký:

```http
POST /auth/register
```

```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Response `201`:

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

Đăng nhập:

```http
POST /auth/login
```

```json
{
  "usernameOrEmail": "john_doe",
  "password": "password123"
}
```

Response `200`:

```json
{
  "access_token": "<jwt>"
}
```

User hiện tại:

```http
GET /auth/me
```

Response `200`:

```json
{
  "id": 1,
  "username": "john_doe",
  "role": "user"
}
```

### 7.3. Users

`GET /users` hỗ trợ:

- `page`: mặc định `1`, tối thiểu `1`.
- `limit`: mặc định `10`, từ `1` đến `100`.

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

`GET /users/:id` trả một `User`.

`PATCH /users/:id/role` nhận:

```json
{
  "role": "admin"
}
```

và trả `User` sau cập nhật.

### 7.4. Todos

`POST /todos` nhận:

```json
{
  "title": "Learn NestJS",
  "description": "Read documentation",
  "isDone": false
}
```

và trả `Todo` với HTTP `201`.

`GET /todos` hỗ trợ:

- `page`: mặc định `1`, tối thiểu `1`.
- `limit`: mặc định `10`, từ `1` đến `100`.
- `isDone`: `"true"` hoặc `"false"`.
- `search`: tìm trong title và description.
- `dateFrom`, `dateTo`: chuỗi ISO 8601.
- `sortBy`: `id`, `title`, `isDone`, `createdAt`, `updatedAt`.
- `sortOrder`: `asc` hoặc `desc`, mặc định `desc`.

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

`GET /todos/:id` và `PATCH /todos/:id` trả một `Todo`.

`PATCH /todos/:id` chỉ nhận:

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "isDone": true
}
```

Mỗi field là tùy chọn nhưng request phải có ít nhất một field hợp lệ.

`DELETE /todos/:id` trả:

```json
{
  "deleted": true
}
```

## 8. Error contract

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

Field `error`, `details`, `requestId` là tùy chọn.

| Status | Ý nghĩa |
| --- | --- |
| `400` | Request hoặc validation không hợp lệ |
| `401` | Chưa xác thực, token/credential sai hoặc hết hạn |
| `403` | Đã xác thực nhưng không đủ quyền |
| `404` | Không tìm thấy tài nguyên |
| `409` | Dữ liệu unique đã tồn tại hoặc vi phạm business rule |
| `500` | Lỗi nội bộ |

Frontend không phụ thuộc vào nguyên văn message để điều khiển business logic; ưu tiên status code và field validation.

## 9. Luồng người dùng chính

### 9.1. Đăng ký và đăng nhập

1. Khách gửi form đăng ký.
2. Backend tạo user role `user`.
3. User đăng nhập bằng username hoặc email.
4. Backend trả access token.
5. Frontend lưu token và gọi `/auth/me`.
6. Frontend điều hướng đến dashboard.

### 9.2. Quản lý todo

1. User mở danh sách todo.
2. Frontend gửi pagination/filter hiện tại.
3. Backend chỉ trả todo user được phép xem.
4. User tạo, sửa, đánh dấu hoàn thành hoặc xóa todo.
5. Frontend đồng bộ lại danh sách và thông báo kết quả.

### 9.3. Quản trị

1. Admin mở danh sách user.
2. Admin xem chi tiết hoặc cập nhật role.
3. Admin có thể xem và thao tác toàn bộ todo.
4. User thường bị từ chối khi truy cập chức năng admin.

## 10. Yêu cầu tích hợp

- Backend bật CORS cho origin frontend theo môi trường.
- Frontend lấy API base URL từ biến môi trường.
- Cả hai phía dùng đúng status code và response shape trong tài liệu này.
- Cookie/token storage không làm mất Bearer header khi SSR hoặc reload.
- Thay đổi role trong khi phiên còn hoạt động phải được xử lý nhất quán; client không được giả định role trong state luôn mới.
- Search/filter không bao giờ được làm lộ todo của user khác.
- Field mới chỉ được thêm vào response theo hướng tương thích ngược; field bắt buộc mới cần phối hợp cả hai phía.

## 11. Kiểm thử tích hợp bắt buộc

- Register → login → me.
- User tạo, xem, sửa và xóa todo của mình.
- User không truy cập được todo của user khác.
- Kết hợp search/filter vẫn giữ đúng owner scope.
- Admin truy cập được mọi todo.
- User không truy cập được API admin.
- Admin xem user và cập nhật role.
- Client xử lý `400`, `401`, `403`, `404`, `409`, `500`.
- Response thực tế khớp contract.
- Password và secret không xuất hiện trong response hoặc log.

## 12. Tiêu chí hoàn thành MVP toàn hệ thống

- Frontend và backend chạy được theo hướng dẫn riêng.
- Toàn bộ endpoint trong API contract hoạt động.
- UI hỗ trợ đủ luồng auth, todo và admin.
- Phân quyền được backend thực thi đúng.
- Validation hoạt động ở cả điểm nhập liệu và API.
- Danh sách todo hỗ trợ pagination, filter, search, date range và sort.
- Build và test quan trọng của cả hai ứng dụng thành công.
- Swagger backend khớp API contract.
- Không có lỗi bảo mật mức nghiêm trọng đã biết.

## 13. Quy tắc cập nhật spec

- Thay đổi contract chung phải cập nhật file này trước hoặc cùng lúc với hai spec con.
- Chi tiết module, entity, migration, guard và vận hành chỉ nằm trong backend spec.
- Chi tiết route UI, component, store, middleware và UX chỉ nằm trong frontend spec.
- Spec con được phép chi tiết hóa nhưng không được mâu thuẫn với tài liệu này.
- Yêu cầu tùy chọn phải tách khỏi tiêu chí MVP.
- Nếu code khác spec, ghi rõ implementation gap trong spec ứng dụng và quyết định sửa code hoặc nâng phiên bản contract.
