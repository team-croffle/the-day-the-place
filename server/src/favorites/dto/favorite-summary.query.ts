import { PLACE_SOURCES, type PlaceSource } from '@nest-vue/shared';
import { IsIn, IsString, Length } from 'class-validator';

export class FavoriteSummaryQuery {
  @IsIn(PLACE_SOURCES)
  source!: PlaceSource;

  @IsString()
  @Length(1, 6500)
  ids!: string;
}
