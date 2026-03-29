import { IsEnum } from 'class-validator';
import { PlanType } from '../../../common/enums/plan-type.enum';

export class CreateSubscriptionCheckoutDto {
  @IsEnum(PlanType)
  planType!: PlanType;
}

