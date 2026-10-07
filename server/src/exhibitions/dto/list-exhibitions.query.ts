import { PLACE_SOURCES, type ExhibitionListQuery } from '@nest-vue/shared';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListExhibitionsQueryDto implements ExhibitionListQuery {
  @IsOptional()
  @IsIn(PLACE_SOURCES)
  placeSource?: ExhibitionListQuery['placeSource'];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placeId?: string;
}
