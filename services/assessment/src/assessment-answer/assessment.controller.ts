import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentEntity } from '../review/assessment.entity';
import { ReviewRepository } from '../review/review.repository';
import { FrameworkRepository } from '../framework/framework.repository';
import { QuestionnaireRepository } from '../questionnaire/questionnaire.repository';
import { AssessmentAnswerEntity } from './assessment-answer.entity';
import { AssessmentAnswerRepository } from './assessment-answer.repository';
import { parseSaveAnswersDto } from './assessment-answer.dto';

@UseGuards(JwtAuthGuard)
@Controller('assessments')
export class AssessmentController {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly answers: AssessmentAnswerRepository,
    private readonly questionnaires: QuestionnaireRepository,
    private readonly frameworks: FrameworkRepository,
  ) {}

  private async loadAssessmentAndReview(assessmentId: string) {
    const assessment = await this.reviews.findAssessmentById(assessmentId);
    if (!assessment) {
      throw new NotFoundException(`Assessment ${assessmentId} not found`);
    }
    const review = await this.reviews.findReviewById(assessment.reviewId);
    if (!review) {
      throw new NotFoundException(`Review ${assessment.reviewId} not found`);
    }
    return { assessment, review };
  }

  private isOwner(assessment: AssessmentEntity, review: { employeeEmail: string; leadEmail: string }, email: string): boolean {
    return (assessment.type === 'SELF' && review.employeeEmail === email) ||
      (assessment.type === 'LEAD' && review.leadEmail === email);
  }

  private async validCompetencyIds(review: { questionnaireId: string }): Promise<Set<string>> {
    const questionnaire = await this.questionnaires.findByIdWithFramework(review.questionnaireId);
    const allCompetencyIds = questionnaire!.framework.categories.flatMap((category) =>
      category.competencies.map((competency) => competency.id),
    );
    return new Set(allCompetencyIds);
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<AssessmentEntity & { answers: AssessmentAnswerEntity[] }> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    const isOwner = this.isOwner(assessment, review, request.user!.email);

    if (!isOwner) {
      const withAssessments = await this.reviews.findByIdWithAssessments(review.id);
      const bothSubmitted = withAssessments!.assessments.every((entry) => entry.status === 'SUBMITTED');
      if (!bothSubmitted) {
        throw new ForbiddenException('Cannot view this assessment yet');
      }
    }

    const answers = await this.answers.findByAssessmentId(id);
    return { ...assessment, answers };
  }

  @Put(':id/answers')
  async saveAnswers(@Param('id') id: string, @Req() request: Request, @Body() body: unknown): Promise<{ saved: true }> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    if (!this.isOwner(assessment, review, request.user!.email)) {
      throw new ForbiddenException('Not the owner of this assessment');
    }
    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Assessment is no longer editable');
    }

    const dto = parseSaveAnswersDto(body);
    const validCompetencyIds = await this.validCompetencyIds(review);
    const invalid = dto.answers.filter((answer) => !validCompetencyIds.has(answer.competencyId));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Unknown competencyId(s) for this questionnaire: ${invalid.map((entry) => entry.competencyId).join(', ')}`,
      );
    }
    await this.answers.saveDraft(id, dto.answers);
    return { saved: true };
  }

  @Post(':id/submit')
  async submit(@Param('id') id: string, @Req() request: Request): Promise<AssessmentEntity> {
    const { assessment, review } = await this.loadAssessmentAndReview(id);
    if (!this.isOwner(assessment, review, request.user!.email)) {
      throw new ForbiddenException('Not the owner of this assessment');
    }
    if (assessment.status !== 'DRAFT') {
      throw new BadRequestException('Assessment already submitted');
    }

    const validCompetencyIds = await this.validCompetencyIds(review);
    const answered = await this.answers.findByAssessmentId(id);
    const answeredIds = new Set(answered.map((entry) => entry.competencyId));
    const missing = [...validCompetencyIds].filter((competencyId) => !answeredIds.has(competencyId));
    if (missing.length > 0) {
      throw new BadRequestException(`Missing answers for competencies: ${missing.join(', ')}`);
    }

    return this.reviews.markSubmitted(id);
  }
}
