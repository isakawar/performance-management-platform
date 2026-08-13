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
import { CreateFramework1723600000000 } from './database/migrations/1723600000000-create-framework';

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
      entities: [FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity],
      migrations: [CreateFramework1723600000000],
      migrationsRun: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([FrameworkEntity, CategoryEntity, CompetencyEntity, CompetencyGradeExpectationEntity]),
  ],
  controllers: [HealthController, FrameworkController, CategoryController],
  providers: [FrameworkRepository],
})
export class AppModule {}
