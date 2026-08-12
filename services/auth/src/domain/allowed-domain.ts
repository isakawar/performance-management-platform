import { UnauthorizedException } from '@nestjs/common';

const ALLOWED_DOMAIN = 'racoongang.com';

export function assertAllowedDomain(email: string): void {
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain !== ALLOWED_DOMAIN) {
    throw new UnauthorizedException(`Email domain not allowed: ${email}`);
  }
}
