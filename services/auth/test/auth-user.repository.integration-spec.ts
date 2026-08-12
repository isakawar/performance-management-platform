import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthUserEntity } from '../src/auth-user/auth-user.entity';
import { AuthUserRepository } from '../src/auth-user/auth-user.repository';
import { CreateAuthUsers1723500000000 } from '../src/database/migrations/1723500000000-create-auth-users';

describe('AuthUserRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: AuthUserRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [AuthUserEntity],
          migrations: [CreateAuthUsers1723500000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([AuthUserEntity]),
      ],
      providers: [AuthUserRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    repository = moduleRef.get(AuthUserRepository);
  }, 60000);

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('creates a new user on first login and reuses it on repeat logins', async () => {
    const first = await repository.findOrCreate('google-sub-1', 'qa1@racoongang.com');
    const second = await repository.findOrCreate('google-sub-1', 'qa1@racoongang.com');

    expect(second.id).toBe(first.id);
    expect(second.email).toBe('qa1@racoongang.com');
  });

  it('creates distinct users for distinct google subs', async () => {
    const first = await repository.findOrCreate('google-sub-2', 'lead1@racoongang.com');
    const second = await repository.findOrCreate('google-sub-3', 'qa2@racoongang.com');

    expect(first.id).not.toBe(second.id);
  });
});
