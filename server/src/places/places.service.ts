import {
  KOREA_PLACES_BBOX,
  type MapPlacesQuery,
  type MapPlacesResponse,
  type PlaceDetail,
  type PlaceSearchQuery,
  type PlaceSearchResult,
  type PlaceSource,
  type RelicDetail,
  type RelicSummary,
} from '@nest-vue/shared';
import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HeritageAdapter } from './adapters/heritage.adapter';
import { TourAdapter } from './adapters/tour.adapter';
import { EmuseumCatalog, EmuseumError, isRelicId } from './emuseum';
import { fetchMapPlaces } from './places-map';
import { searchTourPlaces } from './places-search';

@Injectable()
export class PlacesService {
  private emuseumCatalog: EmuseumCatalog | null = null;

  constructor(
    private readonly tourAdapter: TourAdapter,
    private readonly heritageAdapter: HeritageAdapter,
    private readonly config: ConfigService,
  ) {}

  listMap(query: MapPlacesQuery): Promise<MapPlacesResponse> {
    return fetchMapPlaces(query, (bbox) => this.tourAdapter.listByBbox(bbox));
  }

  search(query: PlaceSearchQuery): Promise<PlaceSearchResult> {
    return searchTourPlaces(query, () => this.tourAdapter.listByBbox(KOREA_PLACES_BBOX));
  }

  async getDetail(source: PlaceSource, id: string): Promise<PlaceDetail> {
    if (source !== 'tour') {
      throw new NotFoundException('Heritage place detail is not available');
    }
    const detail = await this.tourAdapter.getByContentId(id);
    if (!detail) {
      throw new NotFoundException('Place not found');
    }
    try {
      detail.designations = await this.heritageAdapter.findForPlace(detail.name, detail.address);
    } catch {
      detail.designations = null;
    }
    return detail;
  }

  async listRelics(id: string): Promise<RelicSummary[]> {
    const place = await this.museum(id);
    try {
      return await this.emuseum().listForMuseum(place.name);
    } catch (error) {
      throw this.relicFailure(error);
    }
  }

  async getRelic(id: string, relicId: string): Promise<RelicDetail> {
    if (!isRelicId(relicId)) {
      throw new NotFoundException('Relic not found');
    }
    const place = await this.museum(id);
    try {
      const relic = await this.emuseum().detailForMuseum(place.name, relicId);
      if (!relic) {
        throw new NotFoundException('Relic not found');
      }
      return relic;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw this.relicFailure(error);
    }
  }

  async relicImage(id: string, relicId: string): Promise<{ body: Buffer; type: string }> {
    if (!isRelicId(relicId)) {
      throw new NotFoundException('Relic not found');
    }
    const place = await this.museum(id);
    try {
      const image = await this.emuseum().imageForMuseum(place.name, relicId);
      if (!image) {
        throw new NotFoundException('Relic not found');
      }
      return image;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw this.relicFailure(error);
    }
  }

  private async museum(id: string): Promise<PlaceDetail> {
    const place = await this.tourAdapter.getByContentId(id);
    if (!place || place.kind !== 'museum') {
      throw new NotFoundException('Place not found');
    }
    return place;
  }

  private emuseum(): EmuseumCatalog {
    this.emuseumCatalog ??= new EmuseumCatalog({
      apiKey: this.config.get<string>('EMUSEUM_SERVICE_KEY', ''),
    });
    return this.emuseumCatalog;
  }

  private relicFailure(error: unknown): BadGatewayException {
    if (error instanceof EmuseumError) {
      return new BadGatewayException('Relic source failed');
    }
    if (error instanceof BadGatewayException) {
      return error;
    }
    throw error;
  }
}
