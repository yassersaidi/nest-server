import { IsDefined, IsIn, IsUUID } from 'class-validator';
import { memberRoleEnum } from '../schema/conversation';

export class UpdateMemberDto {
  @IsDefined()
  @IsUUID()
  memberId: string;

  @IsDefined()
  @IsIn([memberRoleEnum.enumValues[1], memberRoleEnum.enumValues[2]])
  role?: 'ADMIN' | 'MEMBER';
}
