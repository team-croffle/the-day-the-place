import {
  API_ROUTES,
  PLACE_SOURCES,
  type ApiResponse,
  type MapPlacesResponse,
  type PlaceDetail,
  type PlaceSearchResult,
  type PlaceSource,
  type RelicDetail,
  type RelicSummary,
} from '@nest-vue/shared';
import { BadRequestException, Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';

import { MapPlacesQueryDto } from './dto/map-places.query';
import { SearchPlacesQueryDto } from './dto/search-places.query';
import { PlacesService } from './places.service';

@Controller(API_ROUTES.PLACES)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('map')
  async listMap(@Query() query: MapPlacesQueryDto): Promise<ApiResponse<MapPlacesResponse>> {
    return { data: await this.placesService.listMap(query) };
  }

  @Get('search')
  async search(@Query() query: SearchPlacesQueryDto): Promise<ApiResponse<PlaceSearchResult>> {
    return { data: await this.placesService.search(query) };
  }

  @Get('tour/:id/relics/:relicId/image')
  async relicImage(
    @Param('id') id: string,
    @Param('relicId') relicId: string,
  ): Promise<StreamableFile> {
    const image = await this.placesService.relicImage(id, relicId);
    return new StreamableFile(image.body, { type: image.type });
  }

  @Get('tour/:id/relics/:relicId')
  async getRelic(
    @Param('id') id: string,
    @Param('relicId') relicId: string,
  ): Promise<ApiResponse<RelicDetail>> {
    return { data: await this.placesService.getRelic(id, relicId) };
  }

  @Get('tour/:id/relics')
  async listRelics(@Param('id') id: string): Promise<ApiResponse<RelicSummary[]>> {
    return { data: await this.placesService.listRelics(id) };
  }

  @Get(':source/:id')
  async getDetail(
    @Param('source') source: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<PlaceDetail>> {
    if (!isPlaceSource(source) || id.trim() === '') {
      throw new BadRequestException('source must be tour or heritage, and id is required');
    }
    return { data: await this.placesService.getDetail(source, id) };
  }
}

function isPlaceSource(source: string): source is PlaceSource {
  return (PLACE_SOURCES as readonly string[]).includes(source);
}
