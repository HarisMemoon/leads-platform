import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ResourcesContentKind } from '../../../common/enums/resources-content-kind.enum';

const KINDS = [
  ResourcesContentKind.LINK,
  ResourcesContentKind.VIDEO,
  ResourcesContentKind.FAQ,
  ResourcesContentKind.PROMO,
] as const;

export class CreateResourceContentDto {
  @IsString()
  @IsIn([...KINDS])
  kind!: ResourcesContentKind;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}

export class PatchResourceContentDto {
  @IsOptional()
  @IsString()
  @IsIn([...KINDS])
  kind?: ResourcesContentKind;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string | null;

  @IsOptional()
  @IsString()
  url?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort_order?: number;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;
}
