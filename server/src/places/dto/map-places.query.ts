import type { MapPlacesQuery } from '@nest-vue/shared';
import { Type } from 'class-transformer';
import {
  IsNumber,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import { validateMapBbox } from './map-bbox';

@ValidatorConstraint({ name: 'mapBbox', async: false })
class MapBboxConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    return validateMapBbox(args.object as MapPlacesQuery) === null;
  }

  defaultMessage(): string {
    return 'bbox sw corner must be south-west of ne, with span at most 2 degrees';
  }
}

export class MapPlacesQueryDto implements MapPlacesQuery {
  @Validate(MapBboxConstraint)
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  swLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  swLng!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  neLat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  neLng!: number;
}
