import { IsBoolean } from 'class-validator';

export class AdminDistributionLockDto {
  @IsBoolean()
  locked!: boolean;
}
