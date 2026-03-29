import { Type } from 'class-transformer';
import { IsInt, IsString, IsUUID, Min, MinLength } from 'class-validator';

export class AdminCreditWalletDto {
  @IsUUID()
  user_id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount_cents!: number;

  @IsString()
  @MinLength(3)
  description!: string;
}
