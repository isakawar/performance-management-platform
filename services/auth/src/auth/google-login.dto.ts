import { BadRequestException } from '@nestjs/common';

export interface GoogleLoginDto {
  idToken: string;
}

export function parseGoogleLoginDto(body: unknown): GoogleLoginDto {
  const idToken = (body as Partial<GoogleLoginDto> | undefined)?.idToken;
  if (typeof idToken !== 'string' || idToken.length === 0) {
    throw new BadRequestException('idToken is required');
  }
  return { idToken };
}
