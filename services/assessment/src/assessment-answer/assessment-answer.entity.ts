import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'assessment_answers', schema: 'assessment' })
@Unique(['assessmentId', 'competencyId'])
export class AssessmentAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assessment_id' })
  assessmentId: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @Column()
  grade: string;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', nullable: true })
  evidence: string | null;
}
