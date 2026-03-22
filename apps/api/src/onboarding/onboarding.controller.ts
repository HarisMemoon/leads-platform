import {
    Controller,
    Get,
    Patch,
    Body,
    Req,
    UseGuards
  } from '@nestjs/common';
  import { OnboardingService } from './onboarding.service';
  import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
  import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
  
  @UseGuards(JwtAuthGuard)
  @Controller('onboarding')
  export class OnboardingController {
  
    constructor(private service: OnboardingService) {}
  
    @Get('me')
    getMe(@Req() req) {
      return this.service.get(req.user.userId);
    }
  
    @Patch('me')
    update(
      @Req() req,
      @Body() dto: UpdateOnboardingDto
    ) {
      return this.service.update(req.user.userId, dto);
    }
  }