import { API_ROUTES, type ApiResponse, type Exhibition } from '@nest-vue/shared';
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';

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

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ApiResponse<Exhibition>> {
    return { data: await this.exhibitionsService.findOne(id) };
  }
}
