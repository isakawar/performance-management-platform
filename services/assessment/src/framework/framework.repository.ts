import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrameworkEntity } from './framework.entity';
import { CategoryEntity } from './category.entity';
import { CompetencyEntity } from './competency.entity';
import { CompetencyGradeExpectationEntity } from './competency-grade-expectation.entity';
import { GradeExpectationInput } from './framework.dto';

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

  create(name: string): Promise<FrameworkEntity> {
    return this.frameworks.save(this.frameworks.create({ name }));
  }

  async addCategory(frameworkId: string, name: string, orderIndex: number): Promise<CategoryEntity> {
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
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new NotFoundException(`Category ${categoryId} not found`);
    }
    const competency = await this.competencies.save(
      this.competencies.create({ categoryId, name, description: description ?? null, weight }),
    );
    if (gradeExpectations.length > 0) {
      await this.gradeExpectations.save(
        gradeExpectations.map((entry) =>
          this.gradeExpectations.create({ competencyId: competency.id, grade: entry.grade, description: entry.description }),
        ),
      );
    }
    return competency;
  }

  async findByIdWithStructure(id: string): Promise<FrameworkWithStructure | null> {
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
