import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
