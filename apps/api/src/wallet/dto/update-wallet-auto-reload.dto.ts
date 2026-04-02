import { Type } from 'class-transformer';
import { IsBoolean, IsInt, Max, Min, ValidateIf } from 'class-validator';

export class UpdateWalletAutoReloadDto {
  @IsBoolean()
  auto_reload_enabled!: boolean;

  /** Min $50 — matches wallet UI slider (cents). */
  @ValidateIf((o: UpdateWalletAutoReloadDto) => o.auto_reload_enabled === true)
  @Type(() => Number)
  @IsInt()
  @Min(5000)
  @Max(50000)
  auto_reload_threshold_cents?: number;

  /** Min $100 — matches wallet UI slider (cents). */
  @ValidateIf((o: UpdateWalletAutoReloadDto) => o.auto_reload_enabled === true)
  @Type(() => Number)
  @IsInt()
  @Min(10000)
  @Max(200000)
  auto_reload_amount_cents?: number;
}
