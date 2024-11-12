import { AuthedUserReqType } from '@/resources/auth/interfaces/authed-user.interface';
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      authedUser: AuthedUserReqType,
      sessionId: string
    }
  }
}