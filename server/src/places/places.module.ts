import { Module } from '@nestjs/common';

import { HeritageAdapter } from './adapters/heritage.adapter';
import { TourAdapter } from './adapters/tour.adapter';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, TourAdapter, HeritageAdapter],
  exports: [PlacesService, TourAdapter],
})
export class PlacesModule {}
