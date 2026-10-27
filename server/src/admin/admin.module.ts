import { Module } from '@nestjs/common';

import { CollectorModule } from '../collector/collector.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CollectorModule],
  controllers: [AdminController],
})
export class AdminModule {}
