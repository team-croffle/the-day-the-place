import type { ApiResponse, FavoriteItem, FavoriteSummary } from '@nest-vue/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';

import { AuthService } from '../auth/auth.service';
import { type SessionRequest, SessionUserGuard } from '../auth/session-user.guard';
import { FavoriteSummaryQuery } from './dto/favorite-summary.query';
import { SaveFavoriteDto } from './dto/save-favorite.dto';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly authService: AuthService,
  ) {}

  @Get('summary')
  async summary(
    @Query() query: FavoriteSummaryQuery,
    @Req() request: SessionRequest,
  ): Promise<ApiResponse<FavoriteSummary>> {
    const session = await this.authService.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return {
      data: await this.favoritesService.summary(query.source, query.ids, session?.user.id ?? null),
    };
  }

  @Get()
  @UseGuards(SessionUserGuard)
  async mine(@Req() request: SessionRequest): Promise<ApiResponse<FavoriteItem[]>> {
    return { data: await this.favoritesService.listMine(request.sessionUserId ?? '') };
  }

  @Put()
  @UseGuards(SessionUserGuard)
  async save(
    @Req() request: SessionRequest,
    @Body() dto: SaveFavoriteDto,
  ): Promise<ApiResponse<FavoriteItem>> {
    return { data: await this.favoritesService.save(request.sessionUserId ?? '', dto) };
  }

  @Delete(':source/:placeId')
  @UseGuards(SessionUserGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() request: SessionRequest,
    @Param('source') source: string,
    @Param('placeId') placeId: string,
  ): Promise<void> {
    await this.favoritesService.remove(request.sessionUserId ?? '', source, placeId);
  }
}
