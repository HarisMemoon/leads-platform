import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { AuthService } from './auth.service';
import { PhoneVerificationService } from './phone-verification.service';
import { JwtAuthGuard } from './guards/jwt.auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

@Post('register')
register(@Body() body: RegisterDto): Promise<{ access_token: string }> {
  return this.authService.register(body)
}

@Post('google')
loginGoogle(@Body() body: GoogleAuthDto): Promise<{ access_token: string }> {
  return this.authService.loginWithGoogleIdToken(body.id_token)
}

@Post('login')
login(@Body() body: LoginDto): Promise<{ access_token: string }> {
  return this.authService.login(body.email, body.password)
}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/send-code')
  sendPhoneCode(@Req() req: any): Promise<{ sent: boolean }> {
    return this.phoneVerificationService.sendCode(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/verify-code')
  verifyPhoneCode(
    @Req() req: any,
    @Body() body: VerifyPhoneDto,
  ): Promise<{ verified: boolean }> {
    return this.phoneVerificationService.verifyCode(req.user.userId, body.code);
  }
}