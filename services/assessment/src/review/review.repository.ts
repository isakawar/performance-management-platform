import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionnaireRepository } from '../questionnaire/questionnaire.repository';
import { ReviewEntity } from './review.entity';
import { AssessmentEntity } from './assessment.entity';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ReviewWithAssessments extends ReviewEntity {
  assessments: AssessmentEntity[];
}

@Injectable()
export class ReviewRepository {
  constructor(
    @InjectRepository(ReviewEntity) private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(AssessmentEntity) private readonly assessments: Repository<AssessmentEntity>,
    private readonly questionnaires: QuestionnaireRepository,
  ) {}

  async createReview(
    questionnaireId: string,
    employeeEmail: string,
    leadEmail: string,
  ): Promise<{ review: ReviewEntity; selfAssessmentId: string; leadAssessmentId: string }> {
    const questionnaire = await this.questionnaires.findById(questionnaireId);
    if (!questionnaire) {
      throw new NotFoundException(`Questionnaire ${questionnaireId} not found`);
    }

    return this.reviews.manager.transaction(async (manager) => {
      const review = await manager.save(manager.create(ReviewEntity, { questionnaireId, employeeEmail, leadEmail }));
      const selfAssessment = await manager.save(
        manager.create(AssessmentEntity, { reviewId: review.id, type: 'SELF', status: 'DRAFT', submittedAt: null }),
      );
      const leadAssessment = await manager.save(
        manager.create(AssessmentEntity, { reviewId: review.id, type: 'LEAD', status: 'DRAFT', submittedAt: null }),
      );
      return { review, selfAssessmentId: selfAssessment.id, leadAssessmentId: leadAssessment.id };
    });
  }

  findAllForUser(email: string): Promise<ReviewEntity[]> {
    return this.reviews
      .createQueryBuilder('review')
      .where('review.employee_email = :email OR review.lead_email = :email', { email })
      .orderBy('review.created_at', 'DESC')
      .getMany();
  }

  async findByIdWithAssessments(id: string): Promise<ReviewWithAssessments | null> {
    if (!UUID_PATTERN.test(id)) {
      return null;
    }
    const review = await this.reviews.findOne({ where: { id } });
    if (!review) {
      return null;
    }
    const assessments = await this.assessments.find({ where: { reviewId: id } });
    return { ...review, assessments };
  }

  findAssessmentById(assessmentId: string): Promise<AssessmentEntity | null> {
    if (!UUID_PATTERN.test(assessmentId)) {
      return Promise.resolve(null);
    }
    return this.assessments.findOne({ where: { id: assessmentId } });
  }

  findReviewById(id: string): Promise<ReviewEntity | null> {
    if (!UUID_PATTERN.test(id)) {
      return Promise.resolve(null);
    }
    return this.reviews.findOne({ where: { id } });
  }

  async markSubmitted(assessmentId: string): Promise<AssessmentEntity> {
    await this.assessments.update({ id: assessmentId }, { status: 'SUBMITTED', submittedAt: new Date() });
    const updated = await this.findAssessmentById(assessmentId);
    if (!updated) {
      throw new Error(`Assessment ${assessmentId} disappeared during submit`);
    }
    return updated;
  }
}
