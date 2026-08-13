import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity({ name: 'competency_grade_expectations', schema: 'assessment' })
@Unique(['competencyId', 'grade'])
export class CompetencyGradeExpectationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'competency_id' })
  competencyId: string;

  @Column()
  grade: string;

  @Column()
  description: string;
}
