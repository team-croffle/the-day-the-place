import { EXHIBITION_STATUSES, type ExhibitionStatus } from '@nest-vue/shared';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
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
  @IsOptional()
  @IsInt()
  @Min(0)
  museumOr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  museumnews?: number;
}

export class PendingPostDto {
  @IsIn(['museum_or', 'museumnews'])
  source: 'museum_or' | 'museumnews';

  @IsInt()
  @Min(0)
  postId: number;

  @IsString()
  @MaxLength(500)
  title: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  url: string;

  @IsDateString()
  publishedOn: string;
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

  /** 있으면 못 보낸 글 목록을 이 값으로 바꾼다. 빈 배열은 비운다. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PendingPostDto)
  pending?: PendingPostDto[] | null;
}
