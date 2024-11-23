import { IsDefined, IsIn } from 'class-validator';
import { FriendRequestStatus } from '../enums/request-status.enum';

export class UpdateFriendRequestStatusDto {
  @IsDefined()
  @IsIn([FriendRequestStatus.ACCEPTED, FriendRequestStatus.BLOCKED])
  status: FriendRequestStatus;
}
