import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class AdminResolveRefundDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  admin_notes?: string;

  @ValidateIf((o) => o.status === 'approved')
  @IsString()
  @IsIn(['wallet_credit'])
  resolution?: 'wallet_credit';
}
