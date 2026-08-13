import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'reviews', schema: 'assessment' })
export class ReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'questionnaire_id' })
  questionnaireId: string;

  @Column({ name: 'employee_email' })
  employeeEmail: string;

  @Column({ name: 'lead_email' })
  leadEmail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
