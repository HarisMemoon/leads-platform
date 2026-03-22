import { IsInt, Min, IsOptional, IsString } from 'class-validator';

export class TopupDto {

  @IsInt()
  @Min(1)
  amount_cents!: number;

  @IsOptional()
  @IsString()
  description?: string;
}