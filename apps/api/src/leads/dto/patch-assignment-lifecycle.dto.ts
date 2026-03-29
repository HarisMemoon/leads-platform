import { IsIn, IsString } from 'class-validator';

const PHASES = [
  'new',
  'contacted',
  'follow_up',
  'contract',
  'closed_won',
  'closed_lost',
  'replacement',
] as const;

export class PatchAssignmentLifecycleDto {
  @IsString()
  @IsIn([...PHASES])
  lifecycle_phase!: (typeof PHASES)[number];
}
