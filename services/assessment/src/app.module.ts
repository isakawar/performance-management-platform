import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { FrameworkController, CategoryController } from './framework/framework.controller';
import { FrameworkEntity } from './framework/framework.entity';
import { CategoryEntity } from './framework/category.entity';
import { CompetencyEntity } from './framework/competency.entity';
import { CompetencyGradeExpectationEntity } from './framework/competency-grade-expectation.entity';
import { FrameworkRepository } from './framework/framework.repository';
import { QuestionnaireController } from './questionnaire/questionnaire.controller';
import { QuestionnaireEntity } from './questionnaire/questionnaire.entity';
import { QuestionnaireRepository } from './questionnaire/questionnaire.repository';
import { ReviewController } from './review/review.controller';
import { ReviewEntity } from './review/review.entity';
import { AssessmentEntity } from './review/assessment.entity';
import { ReviewRepository } from './review/review.repository';
import { CreateFramework1723600000000 } from './database/migrations/1723600000000-create-framework';
import { CreateQuestionnaire1723610000000 } from './database/migrations/1723610000000-create-questionnaire';
import { CreateReview1723620000000 } from './database/migrations/1723620000000-create-review';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-secret-change-me';
  }
  return secret;
}

@Module({
  imports: [
    JwtModule.register({
      secret: requireJwtSecret(),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://pmp:pmp_dev_password@localhost:5432/pmp',
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
  controllers: [HealthController, FrameworkController, CategoryController, QuestionnaireController, ReviewController],
  providers: [FrameworkRepository, QuestionnaireRepository, ReviewRepository],
})
export class AppModule {}
