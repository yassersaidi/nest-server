import { UserRoles } from '@/common/enums/user-roles.enum';

export type AuthedUserReqType = {
  id: string;
  role: UserRoles;
  username: string;
  sessionId: string;
};
