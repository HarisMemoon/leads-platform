import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResourcesContent } from '../entities/resources-content.entity';
import { ResourcesPublicController } from './resources-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ResourcesContent])],
  controllers: [ResourcesPublicController],
})
export class ResourcesModule {}
