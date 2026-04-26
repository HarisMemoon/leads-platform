import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourcesContent } from '../entities/resources-content.entity';

@Controller('resources')
export class ResourcesPublicController {
  constructor(
    @InjectRepository(ResourcesContent)
    private readonly repo: Repository<ResourcesContent>,
  ) {}

  @Get('items')
  listPublished() {
    return this.repo.find({
      where: { is_published: true },
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });
  }
}
