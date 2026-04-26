import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

const PHASES = [
  'new',
  'open',
  'contacted',
  'follow_up',
  'under_contract',
  'contract',
  'closed_won',
  'closed_sold',
  'closed_lost',
  'replacement',
] as const;

export class PatchAssignmentLifecycleDto {
  @IsOptional()
  @IsString()
  @IsIn([...PHASES])
  lifecycle_phase?: (typeof PHASES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ValidateIf((o) => o.contract_price_cents !== null)
  contract_price_cents?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @ValidateIf((o) => o.sell_price_cents !== null)
  sell_price_cents?: number | null;

  @IsOptional()
  @IsString()
  buyer_notes?: string | null;
}
