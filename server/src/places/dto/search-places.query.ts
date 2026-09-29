import {
  DEFAULT_PAGE_SIZE,
  MAP_REGION_CHIPS,
  MAX_PAGE_SIZE,
  PLACE_KINDS,
  type PlaceSearchQuery,
} from '@nest-vue/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const REGION_CODES = MAP_REGION_CHIPS.map((chip) => chip.code);

export class SearchPlacesQueryDto implements PlaceSearchQuery {
  @IsIn(PLACE_KINDS)
  kind!: PlaceSearchQuery['kind'];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(REGION_CODES)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  size: number = DEFAULT_PAGE_SIZE;
}
