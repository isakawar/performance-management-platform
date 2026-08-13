import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type AssessmentType = 'SELF' | 'LEAD';
export type AssessmentStatus = 'DRAFT' | 'SUBMITTED';

@Entity({ name: 'assessments', schema: 'assessment' })
@Unique(['reviewId', 'type'])
export class AssessmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'review_id' })
  reviewId: string;

  @Column({ type: 'varchar' })
  type: AssessmentType;

  @Column({ type: 'varchar', default: 'DRAFT' })
  status: AssessmentStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;
}
