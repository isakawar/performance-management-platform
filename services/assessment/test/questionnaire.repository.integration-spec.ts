import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { FrameworkEntity } from '../src/framework/framework.entity';
import { CategoryEntity } from '../src/framework/category.entity';
import { CompetencyEntity } from '../src/framework/competency.entity';
import { CompetencyGradeExpectationEntity } from '../src/framework/competency-grade-expectation.entity';
import { FrameworkRepository } from '../src/framework/framework.repository';
import { QuestionnaireEntity } from '../src/questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { CreateFramework1723600000000 } from '../src/database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from '../src/database/migrations/1723610000000-create-questionnaire';

describe('QuestionnaireRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let frameworks: FrameworkRepository;
  let questionnaires: QuestionnaireRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
          entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity, QuestionnaireEntity],
          migrations: [CreateFramework1723600000000, CreateQuestionnaire1723610000000],
          migrationsRun: true,
          synchronize: false,
        }),
        TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity, QuestionnaireEntity]),
      ],
      providers: [FrameworkRepository, QuestionnaireRepository],
    }).compile();

    dataSource = moduleRef.get(DataSource);
    frameworks = moduleRef.get(FrameworkRepository);
    questionnaires = moduleRef.get(QuestionnaireRepository);
  }, 60000);

  afterAll(async () => {
    await dataSource.destroy();
    await container.stop();
  });

  it('creates a questionnaire referencing an existing framework', async () => {
    const framework = await frameworks.create('QA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 QA Review', 'QA', framework.id);

    expect(questionnaire.frameworkId).toBe(framework.id);
  });

  it('rejects creating a questionnaire for a nonexistent framework', async () => {
    await expect(questionnaires.create('Bad', 'QA', 'not-a-real-id')).rejects.toThrow(NotFoundException);
  });

  it('findByIdWithFramework returns the nested framework structure', async () => {
    const framework = await frameworks.create('AQA Performance Profile');
    const questionnaire = await questionnaires.create('Q1 2026 AQA Review', 'AQA', framework.id);

    const found = await questionnaires.findByIdWithFramework(questionnaire.id);

    expect(found?.framework.name).toBe('AQA Performance Profile');
  });
});
