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
import { QuestionnaireEntity } from '../src/questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { ReviewEntity } from '../src/review/review.entity';
import { AssessmentEntity } from '../src/review/assessment.entity';
import { ReviewRepository } from '../src/review/review.repository';
import { ReviewController } from '../src/review/review.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from '../src/database/migrations/1723620000000-create-review';

describe('ReviewController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let employeeToken: string;
  let leadToken: string;
  let questionnaireId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret' }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [
            FrameworkEntity,
            CategoryEntity,
            CompetencyEntity,
            CompetencyGradeExpectationEntity,
            QuestionnaireEntity,
            ReviewEntity,
            AssessmentEntity,
          ],
          migrations: [CreateFramework1723600000000, CreateQuestionnaire1723610000000, CreateReview1723620000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          FrameworkEntity,
          CategoryEntity,
          CompetencyEntity,
          CompetencyGradeExpectationEntity,
          QuestionnaireEntity,
          ReviewEntity,
          AssessmentEntity,
        ]),
      ],
      controllers: [HealthController, ReviewController],
      providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    employeeToken = jwtService.sign({ sub: 'e1', email: 'qa1@racoongang.com' });
    leadToken = jwtService.sign({ sub: 'l1', email: 'lead1@racoongang.com' });

    const frameworks = moduleFixture.get(FrameworkRepository);
    const questionnaires = moduleFixture.get(QuestionnaireRepository);
    const framework = await frameworks.create('QA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);
    questionnaireId = questionnaire.id;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('creates a review with two DRAFT assessments (SELF, LEAD)', async () => {
    const response = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    expect(response.body.review.employeeEmail).toBe('qa1@racoongang.com');
    expect(typeof response.body.selfAssessmentId).toBe('string');
    expect(typeof response.body.leadAssessmentId).toBe('string');
  });

  it('lists reviews for the current user as employee or lead', async () => {
    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    const asEmployee = await request(app.getHttpServer())
      .get('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);
    const asLead = await request(app.getHttpServer())
      .get('/reviews')
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);

    expect(asEmployee.body.length).toBeGreaterThan(0);
    expect(asLead.body.length).toBeGreaterThan(0);
  });

  it('GET /reviews/:id shows both assessment statuses without a comparison table yet', async () => {
    const created = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ questionnaireId, employeeEmail: 'qa1@racoongang.com', leadEmail: 'lead1@racoongang.com' })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/reviews/${created.body.review.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'SELF', status: 'DRAFT' }),
        expect.objectContaining({ type: 'LEAD', status: 'DRAFT' }),
      ]),
    );
    expect(fetched.body.comparison).toBeUndefined();
  });
});
