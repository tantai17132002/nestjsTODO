import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Endpoint vận hành, không thuộc contract nghiệp vụ MVP.
 */
@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check để theo dõi tiến trình API.
   *
   * @returns Trạng thái sẵn sàng.
   */
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
