import { IsIn, IsOptional, IsString, ValidateIf } from 'class-validator';

export class AdminResolveRefundDto {
  @IsString()
  @IsIn(['approved', 'rejected', 'need_more_proof', 'credited', 'replaced', 'abuse_review'])
  status!: 'approved' | 'rejected' | 'need_more_proof' | 'credited' | 'replaced' | 'abuse_review';

  @IsOptional()
  @IsString()
  admin_notes?: string;

  @ValidateIf((o) => o.status === 'approved' || o.status === 'credited')
  @IsString()
  @IsIn(['wallet_credit'])
  resolution?: 'wallet_credit';
}
