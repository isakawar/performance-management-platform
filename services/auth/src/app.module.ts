import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health/health.controller';
import { AuthController } from './auth/auth.controller';
import { GoogleOidcVerifier } from './google/google-oidc.verifier';
import { AuthTokenService } from './token/auth-token.service';
import { AuthUserRepository } from './auth-user/auth-user.repository';
import { AuthUserEntity } from './auth-user/auth-user.entity';
import { CreateAuthUsers1723500000000 } from './database/migrations/1723500000000-create-auth-users';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL ?? 'postgres://pmp:pmp_dev_password@localhost:5432/pmp',
      entities: [AuthUserEntity],
      migrations: [CreateAuthUsers1723500000000],
      migrationsRun: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([AuthUserEntity]),
  ],
  controllers: [HealthController, AuthController],
  providers: [
    AuthTokenService,
    AuthUserRepository,
    {
      provide: GoogleOidcVerifier,
      useFactory: () => new GoogleOidcVerifier(process.env.GOOGLE_CLIENT_ID ?? 'dev-google-client-id'),
    },
  ],
})
export class AppModule {}
