import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { HealthController } from '../src/health/health.controller';
import { AuthController } from '../src/auth/auth.controller';
import { AuthTokenService } from '../src/token/auth-token.service';
import { AuthUserRepository } from '../src/auth-user/auth-user.repository';
import { AuthUserEntity } from '../src/auth-user/auth-user.entity';
import { CreateAuthUsers1723500000000 } from '../src/database/migrations/1723500000000-create-auth-users';
import { GoogleOidcVerifier } from '../src/google/google-oidc.verifier';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let container: StartedPostgreSqlContainer;
  let jwtService: JwtService;
  const googleVerifierStub = { verify: jest.fn() };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: container.getConnectionUri(),
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
        { provide: GoogleOidcVerifier, useValue: googleVerifierStub },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await container.stop();
  });

  it('issues a token for a first-time login on the allowed domain', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-1',
      email: 'qa1@racoongang.com',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);

    expect(typeof response.body.accessToken).toBe('string');
    const decoded = jwtService.verify(response.body.accessToken);
    expect(decoded).toMatchObject({ email: 'qa1@racoongang.com' });
  });

  it('reuses the same user id across repeat logins', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-2',
      email: 'lead1@racoongang.com',
    });

    const first = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(201);

    const firstSub = jwtService.verify<{ sub: string }>(first.body.accessToken).sub;
    const secondSub = jwtService.verify<{ sub: string }>(second.body.accessToken).sub;
    expect(secondSub).toBe(firstSub);
  });

  it('rejects a login from outside the corporate domain', async () => {
    googleVerifierStub.verify.mockResolvedValue({
      googleSub: 'google-sub-e2e-3',
      email: 'someone@gmail.com',
    });

    await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: 'fake-google-token' })
      .expect(401);
  });
});
