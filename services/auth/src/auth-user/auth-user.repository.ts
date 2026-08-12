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
    await this.repository
      .createQueryBuilder()
      .insert()
      .into(AuthUserEntity)
      .values({ googleSub, email })
      .orUpdate(['email'], ['google_sub'])
      .execute();

    return this.repository.findOneOrFail({ where: { googleSub } });
  }
}
