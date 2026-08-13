import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'questionnaires', schema: 'assessment' })
export class QuestionnaireEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  direction: string;

  @Column({ name: 'framework_id' })
  frameworkId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
