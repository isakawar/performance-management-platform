import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

const WORKSPACE_DOMAIN = 'racoongang.com';

export interface GoogleIdentity {
  googleSub: string;
  email: string;
}

@Injectable()
export class GoogleOidcVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly clientId: string) {
    this.client = new OAuth2Client(clientId);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    let ticket;
    try {
      ticket = await this.client.verifyIdToken({ idToken, audience: this.clientId });
    } catch (error) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }
    if (payload.hd !== WORKSPACE_DOMAIN) {
      throw new UnauthorizedException('Google account is not part of the racoongang.com Workspace');
    }

    return { googleSub: payload.sub, email: payload.email };
  }
}
