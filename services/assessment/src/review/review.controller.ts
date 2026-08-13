import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewEntity } from './review.entity';
import { ReviewRepository, ReviewWithAssessments } from './review.repository';
import { parseCreateReviewDto } from './review.dto';

@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviews: ReviewRepository) {}

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
  async get(@Param('id') id: string): Promise<ReviewWithAssessments> {
    const review = await this.reviews.findByIdWithAssessments(id);
    if (!review) {
      throw new NotFoundException(`Review ${id} not found`);
    }
    return review;
  }
}
