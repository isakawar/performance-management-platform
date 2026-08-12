import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUserEntity } from './auth-user.entity';

@Injectable()
export class AuthUserRepository {
  constructor(
    @InjectRepository(AuthUserEntity)
    private readonly repository: Repository<AuthUserEntity>,
  ) {}

  async findOrCreate(googleSub: string, email: string): Promise<AuthUserEntity> {
    const existing = await this.repository.findOne({ where: { googleSub } });
    if (existing) {
      return existing;
    }

    const created = this.repository.create({ googleSub, email });
    return this.repository.save(created);
  }
}
