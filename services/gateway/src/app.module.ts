import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health/health.controller';
import { WhoAmIController } from './auth/whoami.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    }),
  ],
  controllers: [HealthController, WhoAmIController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
