import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { HealthController } from '../src/health/health.controller';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { FrameworkController, CategoryController } from '../src/framework/framework.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';

describe('FrameworkController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let token: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity],
          migrations: [CreateFramework1723600000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity]),
      ],
      controllers: [HealthController, FrameworkController, CategoryController],
      providers: [FrameworkRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    token = moduleFixture.get(JwtService).sign({ sub: 'u1', email: 'qa1@racoongang.com' });
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('rejects listing frameworks without a token', () => {
    return request(app.getHttpServer()).get('/frameworks').expect(401);
  });

  it('builds a framework end to end: create, add category, add competency with grade expectations, fetch nested', async () => {
    const framework = await request(app.getHttpServer())
      .post('/frameworks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'QA Performance Profile' })
      .expect(201);

    const category = await request(app.getHttpServer())
      .post(`/frameworks/${framework.body.id}/categories`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hard Skills', orderIndex: 0 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/categories/${category.body.id}/competencies`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Planning',
        description: 'Ability to plan testing',
        weight: 2,
        gradeExpectations: [
          { grade: 'JUNIOR', description: 'Basic level' },
          { grade: 'SENIOR', description: 'Expert level' },
        ],
      })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/frameworks/${framework.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(fetched.body.categories).toHaveLength(1);
    expect(fetched.body.categories[0].competencies).toHaveLength(1);
    expect(fetched.body.categories[0].competencies[0].gradeExpectations).toHaveLength(2);
  });
});
