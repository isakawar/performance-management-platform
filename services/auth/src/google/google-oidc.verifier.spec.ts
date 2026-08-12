import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { GoogleOidcVerifier } from './google-oidc.verifier';

describe('GoogleOidcVerifier', () => {
  it('returns the googleSub and email from a valid, verified token', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'qa1@racoongang.com',
        email_verified: true,
      }),
    } as never);

    const identity = await verifier.verify('valid-token');

    expect(identity).toEqual({ googleSub: 'google-sub-1', email: 'qa1@racoongang.com' });
  });

  it('rejects a token whose email is not verified', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'qa1@racoongang.com',
        email_verified: false,
      }),
    } as never);

    await expect(verifier.verify('unverified-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with no payload', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => undefined,
    } as never);

    await expect(verifier.verify('malformed-token')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when verifyIdToken throws', async () => {
    const verifier = new GoogleOidcVerifier('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockRejectedValue(new Error('Token used too late') as never);

    await expect(verifier.verify('expired-token')).rejects.toThrow(UnauthorizedException);
  });
});
