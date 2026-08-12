import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_users', schema: 'auth' })
export class AuthUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'google_sub', unique: true })
  googleSub: string;

  @Column({ unique: true })
  email: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
