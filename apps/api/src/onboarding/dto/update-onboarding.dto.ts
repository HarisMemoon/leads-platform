import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateOnboardingDto {

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  current_step?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  completed_steps?: number[];

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  /** Set to `null` to clear completion (e.g. resume skipped onboarding). */
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @Type(() => Date)
  @IsDate()
  completed_at?: Date | null;
}