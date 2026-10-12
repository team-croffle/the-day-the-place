import type { ApiResponse } from '@nest-vue/shared';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CollectorSecretGuard } from './collector-secret.guard';
import { CollectorService, type CollectorCursor } from './collector.service';
import { IngestExhibitionsDto } from './dto/ingest-exhibitions.dto';

@Controller('collector')
@UseGuards(CollectorSecretGuard)
export class CollectorController {
  constructor(private readonly collector: CollectorService) {}

  @Get('cursor')
  async cursor(): Promise<ApiResponse<CollectorCursor | null>> {
    return { data: await this.collector.readCursor() };
  }

  @Post('ingest')
  async ingest(@Body() body: IngestExhibitionsDto): Promise<ApiResponse<{ deletedEnded: number }>> {
    return { data: { deletedEnded: await this.collector.ingest(body) } };
  }
}
