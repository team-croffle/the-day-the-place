import type { ApiResponse, CollectorStatus } from '@nest-vue/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/admin-session.guard';
import { CollectorService } from '../collector/collector.service';

@Controller('admin')
@UseGuards(AdminSessionGuard)
export class AdminController {
  constructor(private readonly collector: CollectorService) {}

  @Get('collector')
  async collectorStatus(): Promise<ApiResponse<CollectorStatus>> {
    return { data: await this.collector.readStatus() };
  }
}
