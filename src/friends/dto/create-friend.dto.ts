import { IsDefined } from 'class-validator';

export class CreateFriendDto {
  @IsDefined()
  receiverId: string;
}
