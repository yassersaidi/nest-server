import { AuthedUserReqType } from '@/auth/interfaces/authed-user.interface';

declare global {
  namespace Express {
    interface Request {
      authedUser: AuthedUserReqType;
      sessionId: string;
    }
  }
}
