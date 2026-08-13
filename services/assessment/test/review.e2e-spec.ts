import { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
import { AssessmentAnswerEntity } from '../src/assessment-answer/assessment-answer.entity';
import { AssessmentAnswerRepository } from '../src/assessment-answer/assessment-answer.repository';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from '../src/database/migrations/1723620000000-create-review';
import { CreateAssessmentAnswer1723630000000 } from '../src/database/migrations/1723630000000-create-assessment-answer';

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
            AssessmentAnswerEntity,
          ],
          migrations: [CreateFramework1723600000000, CreateQuestionnaire1723610000000, CreateReview1723620000000, CreateAssessmentAnswer1723630000000],
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
          AssessmentAnswerEntity,
        ]),
      ],
      controllers: [HealthController, ReviewController],
      providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository, AssessmentAnswerRepository],
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

  it('GET /reviews/:id includes a comparison once both assessments are submitted', async () => {
    const frameworks = app.get(FrameworkRepository);
    const questionnaires = app.get(QuestionnaireRepository);
    const reviews = app.get(ReviewRepository);
    const answers = app.get(AssessmentAnswerRepository);

    const framework = await frameworks.create('Comparison Test Framework');
    const category = await frameworks.addCategory(framework.id, 'Hard Skills', 0);
    const competency = await frameworks.addCompetency(category.id, 'Debugging', undefined, 1, []);
    const questionnaire = await questionnaires.create('Comparison Test Questionnaire', 'QA', framework.id);
    const created = await reviews.createReview(questionnaire.id, 'qa1@racoongang.com', 'lead1@racoongang.com');

    await answers.saveDraft(created.selfAssessmentId, [{ competencyId: competency.id, grade: 'MIDDLE' }]);
    await answers.saveDraft(created.leadAssessmentId, [{ competencyId: competency.id, grade: 'SENIOR' }]);
    await reviews.markSubmitted(created.selfAssessmentId);
    await reviews.markSubmitted(created.leadAssessmentId);

    const fetched = await request(app.getHttpServer())
      .get(`/reviews/${created.review.id}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.comparison).toEqual([
      { competencyId: competency.id, selfGrade: 'MIDDLE', leadGrade: 'SENIOR' },
    ]);
  });

  it('createReview always leaves exactly two assessment rows for the review (SELF + LEAD)', async () => {
    // This only locks in the "always exactly two rows" invariant on the happy path;
    // it does not exercise a real Postgres-level abort, which would need fault injection.
    const reviews = app.get(ReviewRepository);
    const dataSource = app.get(DataSource);

    const created = await reviews.createReview(questionnaireId, 'qa1@racoongang.com', 'lead1@racoongang.com');

    const count = await dataSource.getRepository(AssessmentEntity).count({ where: { reviewId: created.review.id } });
    expect(count).toBe(2);
  });
});
