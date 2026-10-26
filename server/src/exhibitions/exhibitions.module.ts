import { Module } from '@nestjs/common';

import { PlacesModule } from '../places/places.module';
import { ExhibitionsController } from './exhibitions.controller';
import { ExhibitionsService } from './exhibitions.service';

@Module({
  imports: [PlacesModule],
  controllers: [ExhibitionsController],
  providers: [ExhibitionsService],
})
export class ExhibitionsModule {}
