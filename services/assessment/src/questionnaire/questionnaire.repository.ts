import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FrameworkRepository, FrameworkWithStructure } from '../framework/framework.repository';
import { isValidUuid } from '../shared/uuid';
import { QuestionnaireEntity } from './questionnaire.entity';

export interface QuestionnaireWithFramework extends QuestionnaireEntity {
  framework: FrameworkWithStructure;
}

@Injectable()
export class QuestionnaireRepository {
  constructor(
    @InjectRepository(QuestionnaireEntity) private readonly questionnaires: Repository<QuestionnaireEntity>,
    private readonly frameworks: FrameworkRepository,
  ) {}

  findAll(): Promise<QuestionnaireEntity[]> {
    return this.questionnaires.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<QuestionnaireEntity | null> {
    if (!isValidUuid(id)) {
      return Promise.resolve(null);
    }
    return this.questionnaires.findOne({ where: { id } });
  }

  async create(name: string, direction: string, frameworkId: string): Promise<QuestionnaireEntity> {
    const framework = await this.frameworks.findByIdWithStructure(frameworkId);
    if (!framework) {
      throw new NotFoundException(`Framework ${frameworkId} not found`);
    }
    return this.questionnaires.save(this.questionnaires.create({ name, direction, frameworkId }));
  }

  async findByIdWithFramework(id: string): Promise<QuestionnaireWithFramework | null> {
    const questionnaire = await this.findById(id);
    if (!questionnaire) {
      return null;
    }
    const framework = await this.frameworks.findByIdWithStructure(questionnaire.frameworkId);
    if (!framework) {
      throw new NotFoundException(`Framework ${questionnaire.frameworkId} referenced by questionnaire ${id} is missing`);
    }
    return { ...questionnaire, framework };
  }
}
