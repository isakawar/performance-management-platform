import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from './access-token-payload';

@Injectable()
export class AuthTokenService {
  constructor(private readonly jwtService: JwtService) {}

  issue(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload);
  }

  verify(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token);
  }
}
