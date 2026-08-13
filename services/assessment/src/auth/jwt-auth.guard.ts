import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessTokenPayload } from '@pmp/shared';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token);
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new Error('Malformed access token payload');
      }
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
