import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { HealthController } from './health/health.controller';

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
  controllers: [HealthController],
})
export class AppModule {}
