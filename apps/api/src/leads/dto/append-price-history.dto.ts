import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class AppendPriceHistoryDto {
  @IsInt()
  @Min(0)
  new_price_cents!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
