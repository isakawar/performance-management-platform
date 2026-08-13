import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FrameworkEntity } from './framework.entity';
import { CategoryEntity } from './category.entity';
import { CompetencyEntity } from './competency.entity';
import { FrameworkRepository, FrameworkWithStructure } from './framework.repository';
import { parseCreateCategoryDto, parseCreateCompetencyDto, parseCreateFrameworkDto } from './framework.dto';

@UseGuards(JwtAuthGuard)
@Controller('frameworks')
export class FrameworkController {
  constructor(private readonly frameworks: FrameworkRepository) {}

  @Get()
  list(): Promise<FrameworkEntity[]> {
    return this.frameworks.findAll();
  }

  @Post()
  create(@Body() body: unknown): Promise<FrameworkEntity> {
    const dto = parseCreateFrameworkDto(body);
    return this.frameworks.create(dto.name);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<FrameworkWithStructure> {
    const framework = await this.frameworks.findByIdWithStructure(id);
    if (!framework) {
      throw new NotFoundException(`Framework ${id} not found`);
    }
    return framework;
  }

  @Post(':id/categories')
  createCategory(@Param('id') id: string, @Body() body: unknown): Promise<CategoryEntity> {
    const dto = parseCreateCategoryDto(body);
    return this.frameworks.addCategory(id, dto.name, dto.orderIndex);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoryController {
  constructor(private readonly frameworks: FrameworkRepository) {}

  @Post(':id/competencies')
  createCompetency(@Param('id') id: string, @Body() body: unknown): Promise<CompetencyEntity> {
    const dto = parseCreateCompetencyDto(body);
    return this.frameworks.addCompetency(id, dto.name, dto.description, dto.weight, dto.gradeExpectations);
  }
}
