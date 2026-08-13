import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request = { headers };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      providers: [JwtAuthGuard],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
    jwtService = moduleRef.get(JwtService);
  });

  it('rejects a request with no Authorization header', () => {
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    expect(() => guard.canActivate(makeContext({ authorization: 'Bearer not-a-token' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('allows a valid token and attaches the payload to request.user', () => {
    const token = jwtService.sign({ sub: 'u1', email: 'qa1@racoongang.com' });
    const context = makeContext({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest().user).toMatchObject({ sub: 'u1', email: 'qa1@racoongang.com' });
  });
});
