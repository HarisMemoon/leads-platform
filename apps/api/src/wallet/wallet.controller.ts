import {
    Controller,
    Get,
    Post,
    Patch,
    Query,
    Body,
    Req,
    UseGuards
  } from '@nestjs/common';
  import { WalletService } from './wallet.service';
  import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
  import { TopupDto } from './dto/topup.dto';
  import { UpdateWalletAutoReloadDto } from './dto/update-wallet-auto-reload.dto';
  
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
      @Query('offset') offset: string,
      @Query('type') type?: string,
    ) {
      const txType =
        type === 'credit' || type === 'debit' ? type : undefined;
      return this.service.getTransactions(
        req.user.userId,
        Number(limit) || 10,
        Number(offset) || 0,
        txType,
      );
    }

    @Get('me/transaction-totals')
    getTransactionTotals(@Req() req) {
      return this.service.getTransactionTotals(req.user.userId);
    }

    @Patch('me/auto-reload')
    updateAutoReload(@Req() req, @Body() dto: UpdateWalletAutoReloadDto) {
      return this.service.updateAutoReload(req.user.userId, dto);
    }
  }