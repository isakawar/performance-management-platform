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
import { AssessmentAnswerEntity } from '../src/assessment-answer/assessment-answer.entity';
import { AssessmentAnswerRepository } from '../src/assessment-answer/assessment-answer.repository';
import { AssessmentController } from '../src/assessment-answer/assessment.controller';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from '../src/database/migrations/1723620000000-create-review';
import { CreateAssessmentAnswer1723630000000 } from '../src/database/migrations/1723630000000-create-assessment-answer';

describe('AssessmentController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let employeeToken: string;
  let leadToken: string;
  let competencyId: string;
  let selfAssessmentId: string;
  let leadAssessmentId: string;

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
          migrations: [
            CreateFramework1723600000000,
            CreateQuestionnaire1723610000000,
            CreateReview1723620000000,
            CreateAssessmentAnswer1723630000000,
          ],
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
      controllers: [HealthController, AssessmentController],
      providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository, AssessmentAnswerRepository],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const jwtService = moduleFixture.get(JwtService);
    employeeToken = jwtService.sign({ sub: 'e1', email: 'qa1@racoongang.com' });
    leadToken = jwtService.sign({ sub: 'l1', email: 'lead1@racoongang.com' });

    const frameworks = moduleFixture.get(FrameworkRepository);
    const questionnaires = moduleFixture.get(QuestionnaireRepository);
    const reviews = moduleFixture.get(ReviewRepository);

    const framework = await frameworks.create('QA Performance Profile');
    const category = await frameworks.addCategory(framework.id, 'Hard Skills', 0);
    const competency = await frameworks.addCompetency(category.id, 'Test Planning', undefined, 1, []);
    competencyId = competency.id;
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);
    const created = await reviews.createReview(questionnaire.id, 'qa1@racoongang.com', 'lead1@racoongang.com');
    selfAssessmentId = created.selfAssessmentId;
    leadAssessmentId = created.leadAssessmentId;
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('lets the owner save a draft and read it back', async () => {
    await request(app.getHttpServer())
      .put(`/assessments/${selfAssessmentId}/answers`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ answers: [{ competencyId, grade: 'MIDDLE', comment: 'solid baseline' }] })
      .expect(200);

    const fetched = await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    expect(fetched.body.answers).toEqual([expect.objectContaining({ competencyId, grade: 'MIDDLE' })]);
  });

  it('blocks the lead from reading the self assessment while it is still DRAFT', async () => {
    await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(403);
  });

  it('rejects submit when a competency is unanswered, then succeeds once answered', async () => {
    await request(app.getHttpServer())
      .post(`/assessments/${leadAssessmentId}/submit`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .put(`/assessments/${leadAssessmentId}/answers`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ answers: [{ competencyId, grade: 'SENIOR' }] })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/assessments/${leadAssessmentId}/submit`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(201);
  });

  it('reveals both assessments to either party once both are SUBMITTED', async () => {
    await request(app.getHttpServer())
      .post(`/assessments/${selfAssessmentId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(201);

    const leadReadingSelf = await request(app.getHttpServer())
      .get(`/assessments/${selfAssessmentId}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);
    expect(leadReadingSelf.body.answers).toEqual([expect.objectContaining({ grade: 'MIDDLE' })]);
  });

  it('rejects editing answers after submit', async () => {
    await request(app.getHttpServer())
      .put(`/assessments/${selfAssessmentId}/answers`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ answers: [{ competencyId, grade: 'SENIOR' }] })
      .expect(400);
  });
});
