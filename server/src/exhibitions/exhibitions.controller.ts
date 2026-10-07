import { API_ROUTES, type ApiResponse, type Exhibition } from '@nest-vue/shared';
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { ListExhibitionsQueryDto } from './dto/list-exhibitions.query';
import { ExhibitionsService } from './exhibitions.service';

@Controller(API_ROUTES.EXHIBITIONS)
export class ExhibitionsController {
  constructor(private readonly exhibitionsService: ExhibitionsService) {}

  @Get()
  async list(@Query() query: ListExhibitionsQueryDto): Promise<ApiResponse<Exhibition[]>> {
    if (Boolean(query.placeSource) !== Boolean(query.placeId)) {
      throw new BadRequestException('placeSource and placeId are required together');
    }
    return { data: await this.exhibitionsService.list(query) };
  }
}
