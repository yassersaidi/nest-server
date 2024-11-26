import { IsDefined, IsUUID } from 'class-validator';

export class DeleteMemberDto {
  @IsDefined()
  @IsUUID()
  memberId: string;
}
