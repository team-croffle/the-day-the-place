import { Module } from '@nestjs/common';

import { TourAdapter } from './adapters/tour.adapter';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController],
  providers: [PlacesService, TourAdapter],
  exports: [PlacesService, TourAdapter],
})
export class PlacesModule {}
