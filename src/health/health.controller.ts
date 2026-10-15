import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check(): { status: 'ok'; code: 200; timestamp: string } {
    return { status: 'ok', code: 200, timestamp: new Date().toISOString() };
  }
}
