import { Module } from '@nestjs/common';

import { CollectorSecretGuard } from './collector-secret.guard';
import { CollectorController } from './collector.controller';
import { CollectorService } from './collector.service';

@Module({
  controllers: [CollectorController],
  providers: [CollectorService, CollectorSecretGuard],
  exports: [CollectorService],
})
export class CollectorModule {}
