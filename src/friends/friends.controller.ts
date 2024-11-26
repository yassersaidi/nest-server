import { AuthedUserReqType } from '@/auth/interfaces/authed-user.interface';
import { AuthedUserReq } from '@/common/decorators/authed-user.decorator';
import { IsAuthed } from '@/common/guards/is.authed.guard';
import { UserRolesGuard } from '@/common/guards/user-roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateFriendDto } from './dto/create-friend.dto';
import { UpdateFriendRequestStatusDto } from './dto/update-friend-request-status.dto';
import { FriendsService } from './friends.service';
import { GetFriendsQueryDto } from './dto/get-friends.dto';

@ApiTags('Friends')
@ApiBearerAuth('AuthGuard')
@UseGuards(IsAuthed, UserRolesGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post()
  create(
    @AuthedUserReq() user: AuthedUserReqType,
    @Body() createFriendDto: CreateFriendDto,
  ) {
    return this.friendsService.createFriendRequest(user.id, createFriendDto);
  }

  @Patch(':id')
  updateStatus(
    @AuthedUserReq() user: AuthedUserReqType,
    @Param('id', ParseUUIDPipe) friendRequestId: string,
    @Body() updateFriendRequestStatusDto: UpdateFriendRequestStatusDto,
  ) {
    return this.friendsService.updateFriendStatus(
      user.id,
      friendRequestId,
      updateFriendRequestStatusDto,
    );
  }

  @Delete(':id')
  deleteRequest(
    @Param('id', ParseUUIDPipe) friendRequestId: string,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.friendsService.deleteFriendRequest(user.id, friendRequestId);
  }

  @Get()
  getFriends(
    @AuthedUserReq() user: AuthedUserReqType,
    @Query() getFriendsQuery: GetFriendsQueryDto,
  ) {
    return this.friendsService.getFriends(user.id, getFriendsQuery);
  }
}
