import { IsNotEmpty, IsString } from 'class-validator';

export class SavePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  paymentMethodId!: string;
}

