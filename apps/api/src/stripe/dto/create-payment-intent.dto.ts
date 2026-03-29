import { IsInt, Min } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsInt()
  @Min(1)
  amountCents!: number;
}

