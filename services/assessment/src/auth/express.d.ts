import { AccessTokenPayload } from '@pmp/shared';

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}
