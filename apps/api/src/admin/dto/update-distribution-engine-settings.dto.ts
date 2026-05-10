import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';

export class UpdateDistributionEngineSettingsDto {
  @IsOptional()
  @IsBoolean()
  queue_paused?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  max_auto_distribution_runs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  cooldown_minutes_between_runs?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  markdown_after_days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  markdown_percent?: number;

  /** Minutes after lead creation during which only Pro subscribers can purchase. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  early_access_minutes?: number;
}
