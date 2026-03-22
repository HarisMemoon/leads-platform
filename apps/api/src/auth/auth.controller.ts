import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

@Post('register')
register(@Body() body: RegisterDto): Promise<{ access_token: string }> {
  return this.authService.register(body.email, body.password,body.full_name,body.company_name)
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
}