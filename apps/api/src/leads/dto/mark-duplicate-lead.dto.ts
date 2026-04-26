import { IsUUID } from 'class-validator';

export class MarkDuplicateLeadDto {
  @IsUUID()
  canonical_lead_id!: string;
}
