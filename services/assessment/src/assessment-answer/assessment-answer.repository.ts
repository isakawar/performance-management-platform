import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerInput } from './assessment-answer.dto';
import { AssessmentAnswerEntity } from './assessment-answer.entity';

@Injectable()
export class AssessmentAnswerRepository {
  constructor(
    @InjectRepository(AssessmentAnswerEntity) private readonly answers: Repository<AssessmentAnswerEntity>,
  ) {}

  findByAssessmentId(assessmentId: string): Promise<AssessmentAnswerEntity[]> {
    return this.answers.find({ where: { assessmentId } });
  }

  async saveDraft(assessmentId: string, inputs: AnswerInput[]): Promise<void> {
    for (const input of inputs) {
      const existing = await this.answers.findOne({ where: { assessmentId, competencyId: input.competencyId } });
      if (existing) {
        await this.answers.update(
          { id: existing.id },
          { grade: input.grade, comment: input.comment ?? null, evidence: input.evidence ?? null },
        );
      } else {
        await this.answers.save(
          this.answers.create({
            assessmentId,
            competencyId: input.competencyId,
            grade: input.grade,
            comment: input.comment ?? null,
            evidence: input.evidence ?? null,
          }),
        );
      }
    }
  }
}
