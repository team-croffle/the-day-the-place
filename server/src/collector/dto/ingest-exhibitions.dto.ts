import { EXHIBITION_STATUSES, type ExhibitionStatus } from '@nest-vue/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class IngestDraftDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string | null;

  @IsDateString()
  endsOn: string;

  @IsIn(EXHIBITION_STATUSES)
  status: ExhibitionStatus;

  @IsString()
  @MaxLength(200)
  placeName: string;

  @IsString()
  @MaxLength(2000)
  summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placeSource?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  placeId?: string | null;
}

export class IngestCursorDto {
  @IsDateString()
  seenThrough: string;

  @IsOptional()
  @IsDateString()
  resumeBefore?: string | null;
}

export class IngestExhibitionsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => IngestDraftDto)
  drafts: IngestDraftDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => IngestCursorDto)
  cursor?: IngestCursorDto | null;
}
