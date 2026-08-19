import { LoggerService, Injectable } from '@nestjs/common';

/**
 * CustomLogger - Service tùy chỉnh cho logging
 *
 * Đây là implementation của NestJS LoggerService interface
 * Cung cấp logging với màu sắc và format tùy chỉnh
 * Sử dụng process.stdout/stderr thay vì console để tương thích với production
 *
 * Tại sao dùng process.stdout/stderr thay vì console?
 * - Console có thể bị override trong production environments
 * - Process streams đảm bảo output luôn được ghi đúng cách
 * - Tương thích với log aggregation systems (ELK, CloudWatch, etc.)
 * - Không bị ảnh hưởng bởi console.log overrides
 * - Thread-safe: An toàn khi sử dụng trong multi-thread environments
 *
 * Features:
 * - Log levels: log, error, warn, debug
 * - Color coding: Mỗi level có màu riêng để dễ phân biệt
 * - Prefix tags: [LOG], [ERROR], [WARN], [DEBUG]
 * - Stack trace support: Hiển thị stack trace cho errors
 * - Production ready: Sử dụng process.stdout/stderr
 *
 * Color Scheme:
 * - LOG (Cyan): Thông tin thông thường, success messages
 * - ERROR (Red): Lỗi nghiêm trọng, exceptions
 * - WARN (Yellow): Cảnh báo, potential issues
 * - DEBUG (Magenta): Debug information, development logs
 *
 * Usage:
 * // Trong service/controller
 * constructor(private readonly logger: CustomLogger) {}
 *
 * // Log levels examples
 * this.logger.log('User logged in successfully');
 * this.logger.error('Database connection failed', error.stack);
 * this.logger.warn('Rate limit approaching');
 * this.logger.debug('Processing request data');
 *
 * // Output examples:
 * // [LOG] User logged in successfully (màu cyan)
 * // [ERROR] Database connection failed (màu đỏ)
 * // [WARN] Rate limit approaching (màu vàng)
 * // [DEBUG] Processing request data (màu magenta)
 */
@Injectable()
export class CustomLogger implements LoggerService {
  /**
   * Log thông tin thông thường (INFO level)
   *
   * Sử dụng cho:
   * - Thông tin thành công (success messages)
   * - Business logic events (user created, order placed, etc.)
   * - General information cần track
   *
   * @param message - Nội dung log message
   *
   * @example
   * logger.log('User created successfully');
   * logger.log('Order #12345 placed successfully');
   * logger.log('Payment processed for user ID: 456');
   *
   * // Output: [LOG] User created successfully (màu cyan)
   * // Output: [LOG] Order #12345 placed successfully (màu cyan)
   * // Output: [LOG] Payment processed for user ID: 456 (màu cyan)
   */
  log(message: string) {
    // Sử dụng process.stdout.write thay vì console.log
    // \x1b[36m = ANSI color code cho cyan
    // \x1b[0m = Reset color về default
    process.stdout.write(`\x1b[36m[LOG]\x1b[0m ${message}\n`); // cyan
  }

  /**
   * Log lỗi và stack trace (ERROR level)
   *
   * Sử dụng cho:
   * - Lỗi nghiêm trọng (critical errors)
   * - Exceptions và unhandled errors
   * - Database connection failures
   * - API failures, network errors
   * - Security violations
   *
   * @param message - Nội dung error message (mô tả lỗi)
   * @param trace - Stack trace của error (optional, để debug)
   *
   * @example
   * logger.error('Database connection failed', error.stack);
   * logger.error('Failed to process payment', paymentError.stack);
   * logger.error('Unauthorized access attempt', null);
   *
   * // Output: [ERROR] Database connection failed (màu đỏ)
   * //         + stack trace nếu có
   * // Output: [ERROR] Failed to process payment (màu đỏ)
   * //         + stack trace nếu có
   * // Output: [ERROR] Unauthorized access attempt (màu đỏ)
   */
  error(message: string, trace?: string) {
    // Sử dụng process.stderr.write cho error logs
    // \x1b[31m = ANSI color code cho red
    process.stderr.write(`\x1b[31m[ERROR]\x1b[0m ${message}\n`);
    if (trace) {
      // Ghi stack trace riêng dòng để dễ đọc
      process.stderr.write(`${trace}\n`);
    }
  }

  /**
   * Log cảnh báo (WARN level)
   *
   * Sử dụng cho:
   * - Cảnh báo về potential issues
   * - Rate limiting warnings
   * - Deprecated feature usage
   * - Performance degradation warnings
   * - Security warnings (non-critical)
   * - Resource usage warnings (disk space, memory, etc.)
   *
   * @param message - Nội dung warning message
   *
   * @example
   * logger.warn('Rate limit approaching');
   * logger.warn('Database connection pool is 80% full');
   * logger.warn('Using deprecated API endpoint');
   * logger.warn('High memory usage detected: 85%');
   *
   * // Output: [WARN] Rate limit approaching (màu vàng)
   * // Output: [WARN] Database connection pool is 80% full (màu vàng)
   * // Output: [WARN] Using deprecated API endpoint (màu vàng)
   * // Output: [WARN] High memory usage detected: 85% (màu vàng)
   */
  warn(message: string) {
    // \x1b[33m = ANSI color code cho yellow
    process.stdout.write(`\x1b[33m[WARN]\x1b[0m ${message}\n`); // yellow
  }

  /**
   * Log debug information (DEBUG level)
   *
   * Sử dụng cho:
   * - Development và debugging information
   * - Step-by-step process tracking
   * - Variable values và state information
   * - Method entry/exit points
   * - Performance metrics
   * - Detailed flow information
   *
   * Lưu ý: Debug logs thường chỉ hiển thị trong development environment
   * Có thể disable trong production để tăng performance
   *
   * @param message - Nội dung debug message
   *
   * @example
   * logger.debug('Processing request data');
   * logger.debug('User ID: 123, Role: admin');
   * logger.debug('Database query executed: SELECT * FROM users');
   * logger.debug('Method validateUser() called with username: john_doe');
   * logger.debug('Response time: 45ms');
   *
   * // Output: [DEBUG] Processing request data (màu magenta)
   * // Output: [DEBUG] User ID: 123, Role: admin (màu magenta)
   * // Output: [DEBUG] Database query executed: SELECT * FROM users (màu magenta)
   * // Output: [DEBUG] Method validateUser() called with username: john_doe (màu magenta)
   * // Output: [DEBUG] Response time: 45ms (màu magenta)
   */
  debug?(message: string) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    process.stdout.write(`\x1b[35m[DEBUG]\x1b[0m ${message}\n`);
  }
}

/**
 * Best Practices khi sử dụng CustomLogger:
 *
 * 1. Log Levels:
 *    - LOG: Thông tin thành công, business events
 *    - ERROR: Lỗi nghiêm trọng, exceptions
 *    - WARN: Cảnh báo, potential issues
 *    - DEBUG: Development information (có thể disable trong production)
 *
 * 2. Message Format:
 *    - Sử dụng descriptive messages
 *    - Include relevant IDs (user ID, order ID, etc.)
 *    - Avoid logging sensitive information (passwords, tokens)
 *    - Use consistent format across application
 *
 * 3. Performance:
 *    - Debug logs có thể ảnh hưởng performance
 *    - Consider log level filtering trong production
 *    - Use structured logging cho complex data
 *
 * 4. Security:
 *    - Không log sensitive data (passwords, API keys, tokens)
 *    - Sanitize user input trước khi log
 *    - Consider log rotation và retention policies
 *
 * 5. Integration:
 *    - Tương thích với log aggregation systems
 *    - Support structured logging formats (JSON)
 *    - Consider log correlation IDs cho distributed systems
 */
