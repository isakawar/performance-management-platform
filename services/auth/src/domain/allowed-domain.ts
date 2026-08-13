import { UnauthorizedException } from '@nestjs/common';

export const ALLOW_ANY_DOMAIN = '*';

export function assertAllowedDomain(email: string, allowedDomain: string): void {
  if (allowedDomain === ALLOW_ANY_DOMAIN) {
    return;
  }
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain !== allowedDomain.toLowerCase()) {
    throw new UnauthorizedException(`Email domain not allowed: ${email}`);
  }
}
