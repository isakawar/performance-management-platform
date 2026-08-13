import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'categories', schema: 'assessment' })
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'framework_id' })
  frameworkId: string;

  @Column()
  name: string;

  @Column({ name: 'order_index', default: 0 })
  orderIndex: number;
}
