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
  async listPublished() {
    try {
      return await this.repo.find({
        where: { is_published: true },
        order: { sort_order: 'ASC', created_at: 'DESC' },
      });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '42P01' || code === '42703') {
        return [];
      }
      throw error;
    }
  }
}
