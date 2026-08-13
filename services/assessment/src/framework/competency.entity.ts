import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'competencies', schema: 'assessment' })
export class CompetencyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', default: 1 })
  weight: number;
}
