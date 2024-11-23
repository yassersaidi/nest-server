import { IsIn, IsInt, IsNotEmpty, Min } from 'class-validator';
import { FriendRequestStatus } from '../enums/request-status.enum';
export class GetFriendsQueryDto {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  limit: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  offset: number;

  @IsNotEmpty()
  @IsIn([...Object.values(FriendRequestStatus)])
  status: FriendRequestStatus;

  @IsNotEmpty()
  @IsIn([1, -1])
  order: number;
}
