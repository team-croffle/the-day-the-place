import { API_ROUTES, type ApiResponse, type MapPlacesResponse } from '@nest-vue/shared';
import { Controller, Get, Query } from '@nestjs/common';

import { MapPlacesQueryDto } from './dto/map-places.query';
import { PlacesService } from './places.service';

@Controller(API_ROUTES.PLACES)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('map')
  async listMap(@Query() query: MapPlacesQueryDto): Promise<ApiResponse<MapPlacesResponse>> {
    return { data: await this.placesService.listMap(query) };
  }
}
