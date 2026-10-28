import {
  PLACE_KINDS,
  PLACE_SOURCES,
  type PlaceKind,
  type PlaceSource,
  type SaveFavoritePayload,
} from '@nest-vue/shared';
import { IsIn, IsString, Length } from 'class-validator';

export class SaveFavoriteDto implements SaveFavoritePayload {
  @IsIn(PLACE_SOURCES)
  source!: PlaceSource;

  @IsString()
  @Length(1, 64)
  placeId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsIn(PLACE_KINDS)
  kind!: PlaceKind;
}
