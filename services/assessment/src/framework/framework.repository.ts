import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { FrameworkEntity } from './framework.entity';
import { CategoryEntity } from './category.entity';
import { CompetencyEntity } from './competency.entity';
import { CompetencyGradeExpectationEntity } from './competency-grade-expectation.entity';
import { GradeExpectationInput } from './framework.dto';
import { isValidUuid } from '../shared/uuid';

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = (error as QueryFailedError & { code?: string; driverError?: { code?: string } }).driverError;
  const code = (error as QueryFailedError & { code?: string }).code ?? driverError?.code;
  return code === '23505';
}

export interface FrameworkWithStructure extends FrameworkEntity {
  categories: (CategoryEntity & {
    competencies: (CompetencyEntity & { gradeExpectations: CompetencyGradeExpectationEntity[] })[];
  })[];
}

@Injectable()
export class FrameworkRepository {
  constructor(
    @InjectRepository(FrameworkEntity) private readonly frameworks: Repository<FrameworkEntity>,
    @InjectRepository(CategoryEntity) private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(CompetencyEntity) private readonly competencies: Repository<CompetencyEntity>,
    @InjectRepository(CompetencyGradeExpectationEntity)
    private readonly gradeExpectations: Repository<CompetencyGradeExpectationEntity>,
  ) {}

  findAll(): Promise<FrameworkEntity[]> {
    return this.frameworks.find({ order: { name: 'ASC' } });
  }

  async create(name: string): Promise<FrameworkEntity> {
    try {
      return await this.frameworks.save(this.frameworks.create({ name }));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(`Framework with name ${name} already exists`);
      }
      throw error;
    }
  }

  async addCategory(frameworkId: string, name: string, orderIndex: number): Promise<CategoryEntity> {
    if (!isValidUuid(frameworkId)) {
      throw new NotFoundException(`Framework ${frameworkId} not found`);
    }
    const framework = await this.frameworks.findOne({ where: { id: frameworkId } });
    if (!framework) {
      throw new NotFoundException(`Framework ${frameworkId} not found`);
    }
    return this.categories.save(this.categories.create({ frameworkId, name, orderIndex }));
  }

  async addCompetency(
    categoryId: string,
    name: string,
    description: string | undefined,
    weight: number,
    gradeExpectations: GradeExpectationInput[],
  ): Promise<CompetencyEntity> {
    if (!isValidUuid(categoryId)) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    const competency = await this.competencies.save(
      this.competencies.create({ categoryId, name, description: description ?? null, weight }),
    );
    if (gradeExpectations.length > 0) {
      try {
        await this.gradeExpectations.save(
          gradeExpectations.map((entry) =>
            this.gradeExpectations.create({ competencyId: competency.id, grade: entry.grade, description: entry.description }),
          ),
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(`Duplicate grade expectation for competency ${competency.id}`);
        }
        throw error;
      }
    }
    return competency;
  }

  async findByIdWithStructure(id: string): Promise<FrameworkWithStructure | null> {
    if (!isValidUuid(id)) {
      return null;
    }
    const framework = await this.frameworks.findOne({ where: { id } });
    if (!framework) {
      return null;
    }
    const categories = await this.categories.find({ where: { frameworkId: id }, order: { orderIndex: 'ASC' } });
    const categoriesWithCompetencies = await Promise.all(
      categories.map(async (category) => {
        const competencies = await this.competencies.find({ where: { categoryId: category.id } });
        const competenciesWithGrades = await Promise.all(
          competencies.map(async (competency) => {
            const grades = await this.gradeExpectations.find({ where: { competencyId: competency.id } });
            return { ...competency, gradeExpectations: grades };
          }),
        );
        return { ...category, competencies: competenciesWithGrades };
      }),
    );
    return { ...framework, categories: categoriesWithCompetencies };
  }
}
