import { Body, Controller, Post } from '@nestjs/common';
import { assertAllowedDomain } from '../domain/allowed-domain';
import { GoogleOidcVerifier } from '../google/google-oidc.verifier';
import { AuthTokenService } from '../token/auth-token.service';
import { AuthUserRepository } from '../auth-user/auth-user.repository';
import { parseGoogleLoginDto } from './google-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleVerifier: GoogleOidcVerifier,
    private readonly authUserRepository: AuthUserRepository,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post('google')
  async loginWithGoogle(@Body() body: unknown): Promise<{ accessToken: string }> {
    const dto = parseGoogleLoginDto(body);
    const identity = await this.googleVerifier.verify(dto.idToken);
    assertAllowedDomain(identity.email, process.env.ALLOWED_EMAIL_DOMAIN ?? 'racoongang.com');

    const user = await this.authUserRepository.findOrCreate(identity.googleSub, identity.email);
    const accessToken = this.authTokenService.issue({ sub: user.id, email: user.email });

    return { accessToken };
  }
}
