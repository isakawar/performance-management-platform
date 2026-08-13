import { UnauthorizedException } from '@nestjs/common';
import { ALLOW_ANY_DOMAIN, assertAllowedDomain } from './allowed-domain';

describe('assertAllowedDomain', () => {
  it('allows an email on the configured corporate domain', () => {
    expect(() => assertAllowedDomain('qa1@racoongang.com', 'racoongang.com')).not.toThrow();
  });

  it('is case-insensitive on the domain part', () => {
    expect(() => assertAllowedDomain('qa1@RacoonGang.com', 'racoongang.com')).not.toThrow();
  });

  it('rejects an email on any other domain', () => {
    expect(() => assertAllowedDomain('someone@gmail.com', 'racoongang.com')).toThrow(UnauthorizedException);
  });

  it('rejects a malformed email with no domain', () => {
    expect(() => assertAllowedDomain('not-an-email', 'racoongang.com')).toThrow(UnauthorizedException);
  });

  it('allows any domain when the allowed domain is the wildcard', () => {
    expect(() => assertAllowedDomain('someone@gmail.com', ALLOW_ANY_DOMAIN)).not.toThrow();
  });
});
