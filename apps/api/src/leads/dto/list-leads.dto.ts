import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { LeadStatus } from '../../../common/enums/lead-status.enum';

export class ListLeadsDto {
  @IsOptional()
  @IsString()
  market?: string;

  @IsOptional()
  @IsIn(['inbound', 'outbound'])
  source?: 'inbound' | 'outbound';

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 25;
}
