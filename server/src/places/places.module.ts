import { Module } from '@nestjs/common';

import { TourAdapter } from './adapters/tour.adapter';

@Module({
  providers: [TourAdapter],
  exports: [TourAdapter],
})
export class PlacesModule {}
