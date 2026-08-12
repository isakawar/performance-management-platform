import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthTokenService } from './auth-token.service';

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } })],
      providers: [AuthTokenService],
    }).compile();

    service = moduleRef.get(AuthTokenService);
  });

  it('issues a token that verifies back to the same payload', () => {
    const token = service.issue({ sub: 'user-1', email: 'qa1@racoongang.com' });
    const decoded = service.verify(token);

    expect(decoded).toMatchObject({ sub: 'user-1', email: 'qa1@racoongang.com' });
  });

  it('throws when verifying a token signed with a different secret', async () => {
    const otherModuleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'other-secret' })],
      providers: [AuthTokenService],
    }).compile();
    const otherService = otherModuleRef.get(AuthTokenService);
    const tokenFromOtherSecret = otherService.issue({ sub: 'user-1', email: 'qa1@racoongang.com' });

    expect(() => service.verify(tokenFromOtherSecret)).toThrow();
  });
});
