import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health/health.controller';
import { WhoAmIController } from './auth/whoami.controller';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

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
  ],
  controllers: [HealthController, WhoAmIController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
