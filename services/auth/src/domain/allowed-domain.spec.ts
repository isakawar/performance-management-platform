import { UnauthorizedException } from '@nestjs/common';
import { assertAllowedDomain } from './allowed-domain';

describe('assertAllowedDomain', () => {
  it('allows an email on the corporate domain', () => {
    expect(() => assertAllowedDomain('qa1@racoongang.com')).not.toThrow();
  });

  it('is case-insensitive on the domain part', () => {
    expect(() => assertAllowedDomain('qa1@RacoonGang.com')).not.toThrow();
  });

  it('rejects an email on any other domain', () => {
    expect(() => assertAllowedDomain('someone@gmail.com')).toThrow(UnauthorizedException);
  });

  it('rejects a malformed email with no domain', () => {
    expect(() => assertAllowedDomain('not-an-email')).toThrow(UnauthorizedException);
  });
});
