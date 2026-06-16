import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TermsAcceptance } from '../entities/terms-acceptance.entity';
import { TermsController } from './terms.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([TermsAcceptance])],
  controllers: [TermsController],
  exports: [TypeOrmModule],
})
export class TermsModule {}
