import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Req,
    UseGuards
  } from '@nestjs/common';
  import { WalletService } from './wallet.service';
  import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
  import { TopupDto } from './dto/topup.dto';
  
  @UseGuards(JwtAuthGuard)
  @Controller('wallet')
  export class WalletController {
  
    constructor(private service: WalletService) {}
  
    /*
    GET /wallet/me
    */
    @Get('me')
    getWallet(@Req() req) {
      return this.service.getWallet(req.user.userId);
    }
  
    /*
    POST /wallet/me/topup
    */
    @Post('me/topup')
    topup(@Req() req, @Body() dto: TopupDto) {
      return this.service.topup(
        req.user.userId,
        dto.amount_cents,
        dto.description
      );
    }
  
    /*
    GET /wallet/me/transactions
    */
    @Get('me/transactions')
    getTransactions(
      @Req() req,
      @Query('limit') limit: string,
      @Query('offset') offset: string
    ) {
      return this.service.getTransactions(
        req.user.userId,
        Number(limit) || 50,
        Number(offset) || 0
      );
    }
  }