import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateRefundRequestDto {
  @IsUUID()
  assignment_id!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
