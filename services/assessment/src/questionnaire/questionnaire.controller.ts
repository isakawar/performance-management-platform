import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuestionnaireEntity } from './questionnaire.entity';
import { QuestionnaireRepository, QuestionnaireWithFramework } from './questionnaire.repository';
import { parseCreateQuestionnaireDto } from './questionnaire.dto';

@UseGuards(JwtAuthGuard)
@Controller('questionnaires')
export class QuestionnaireController {
  constructor(private readonly questionnaires: QuestionnaireRepository) {}

  @Get()
  list(): Promise<QuestionnaireEntity[]> {
    return this.questionnaires.findAll();
  }

  @Post()
  create(@Body() body: unknown): Promise<QuestionnaireEntity> {
    const dto = parseCreateQuestionnaireDto(body);
    return this.questionnaires.create(dto.name, dto.direction, dto.frameworkId);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<QuestionnaireWithFramework> {
    const questionnaire = await this.questionnaires.findByIdWithFramework(id);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire ${id} not found`);
    }
    return questionnaire;
  }
}
