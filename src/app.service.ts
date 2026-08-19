import { Injectable } from '@nestjs/common';

/**
 * Trả trạng thái health của tiến trình API.
 */
@Injectable()
export class AppService {
  /**
   * @returns `{ status: 'ok' }` khi ứng dụng đang chạy.
   */
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
