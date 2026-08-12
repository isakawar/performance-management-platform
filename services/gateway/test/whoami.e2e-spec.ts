import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('WhoAmI (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects requests to /auth/me without a token', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the decoded payload for a request with a valid token', async () => {
    const token = jwtService.sign({ sub: 'user-1', email: 'qa1@racoongang.com' });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({ sub: 'user-1', email: 'qa1@racoongang.com' });
  });

  it('still allows unauthenticated access to /health', () => {
    return request(app.getHttpServer()).get('/health').expect(200).expect({ status: 'ok' });
  });
});
