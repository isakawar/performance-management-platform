import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssessmentAnswerRepository } from '../assessment-answer/assessment-answer.repository';
import { ReviewEntity } from './review.entity';
import { ReviewRepository, ReviewWithAssessments } from './review.repository';
import { parseCreateReviewDto } from './review.dto';

interface ComparisonEntry {
  competencyId: string;
  selfGrade: string;
  leadGrade: string;
}

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly answers: AssessmentAnswerRepository,
  ) {}

  @Post()
  async create(
    @Body() body: unknown,
  ): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }> {
    const dto = parseCreateReviewDto(body);
    return this.reviews.createReview(dto.questionnaireId, dto.employeeEmail, dto.leadEmail);
  }

  @Get()
  list(@Req() request: Request): Promise<ReviewEntity[]> {
    return this.reviews.findAllForUser(request.user!.email);
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<ReviewWithAssessments & { comparison?: ComparisonEntry[] }> {
    const review = await this.reviews.findByIdWithAssessments(id);
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }

    const bothSubmitted = review.assessments.every((entry) => entry.status === 'SUBMITTED');
    if (!bothSubmitted) {
      return review;
    }

    const selfAssessment = review.assessments.find((entry) => entry.type === 'SELF')!;
    const leadAssessment = review.assessments.find((entry) => entry.type === 'LEAD')!;
    const selfAnswers = await this.answers.findByAssessmentId(selfAssessment.id);
    const leadAnswers = await this.answers.findByAssessmentId(leadAssessment.id);
    const leadByCompetency = new Map(leadAnswers.map((entry) => [entry.competencyId, entry.grade]));

    const comparison: ComparisonEntry[] = selfAnswers
      .filter((entry) => leadByCompetency.has(entry.competencyId))
      .map((entry) => ({
        competencyId: entry.competencyId,
        selfGrade: entry.grade,
        leadGrade: leadByCompetency.get(entry.competencyId)!,
      }));

    return { ...review, comparison };
  }
}
