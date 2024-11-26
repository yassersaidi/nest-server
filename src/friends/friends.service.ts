import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { UsersService } from '@/users/users.service';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, or } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateFriendDto } from './dto/create-friend.dto';
import { GetFriendsQueryDto } from './dto/get-friends.dto';
import { UpdateFriendRequestStatusDto } from './dto/update-friend-request-status.dto';

@Injectable()
export class FriendsService {
  private readonly logger = new Logger(FriendsService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    private readonly userService: UsersService,
  ) {}

  async createFriendRequest(
    senderId: string,
    createFriendDto: CreateFriendDto,
  ) {
    this.logger.log(
      `${senderId} attempting to send a friend request to ${createFriendDto.receiverId}`,
    );
    if (senderId === createFriendDto.receiverId) {
      this.logger.warn(
        `${senderId} attempted to send a friend request to themselves`,
      );
      throw new DefaultHttpException(
        `You cannot send a friend request to yourself`,
        'Friend requests are meant for connecting with others',
        'Friends Service',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const receiver = await this.userService.findById(
        createFriendDto.receiverId,
      );
      if (!receiver) {
        this.logger.warn(
          `${senderId} attempted to send a friend request to a non-existent user (${createFriendDto.receiverId})`,
        );
        throw new DefaultHttpException(
          `The user you are trying to send a friend request to does not exist`,
          'Please check the user ID and try again',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const [friendsStatus] = await this.getFriendStatus(
        senderId,
        createFriendDto.receiverId,
      );

      if (friendsStatus) {
        if (friendsStatus.status === 'PENDING') {
          this.logger.warn(
            `${senderId} already sent a friend request to ${createFriendDto.receiverId}`,
          );
          throw new DefaultHttpException(
            `${friendsStatus.receiverId === senderId ? 'You already received this friend request' : 'You already sent a friend request'}`,
            `${friendsStatus.receiverId === senderId ? 'You can accept or block this friend request' : 'You can send another request if the previous one is deleted'}`,
            'Friends Service',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (friendsStatus.status === 'BLOCKED') {
          this.logger.warn(
            `${senderId} attempted to send a friend request to ${createFriendDto.receiverId}, but is blocked`,
          );
          throw new DefaultHttpException(
            `${friendsStatus.receiverId === senderId ? 'You blocked this friend request' : `You can't send a friend request to this user`}`,
            `${friendsStatus.receiverId === senderId ? 'Unblock or delete this friend request' : `The user has blocked you or restricted requests`}`,
            'Friends Service',
            HttpStatus.BAD_REQUEST,
          );
        }

        if (friendsStatus.status === 'ACCEPTED') {
          this.logger.warn(
            `${senderId} attempted to send a friend request to ${createFriendDto.receiverId}, but they are already friends`,
          );
          throw new DefaultHttpException(
            `You are already friends with this user`,
            'Friend request is unnecessary as you are already connected',
            'Friends Service',
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      const friendValues: typeof db_schema.Friend.$inferInsert = {
        senderId,
        receiverId: createFriendDto.receiverId,
      };

      const [friend] = await this.db
        .insert(db_schema.Friend)
        .values(friendValues)
        .returning({
          id: db_schema.Friend.id,
          status: db_schema.Friend.status,
          createdAt: db_schema.Friend.createdAt,
        });

      this.logger.log(
        `${senderId} successfully sent a friend request to ${createFriendDto.receiverId}`,
      );

      return {
        message: 'Friend request sent successfully',
        friend,
      };
    } catch (error) {
      this.logger.error(
        `Error creating friend request from ${senderId} to ${createFriendDto.receiverId}`,
        error.stack,
      );

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to process the friend request',
        'Please try again later',
        'Friends Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getFriendRequestById(requestId: string) {
    try {
      this.logger.log(`Searching for request with ID: ${requestId}`);
      const [request] = await this.db
        .select()
        .from(db_schema.Friend)
        .where(eq(db_schema.Friend.id, requestId));

      if (!request) {
        this.logger.warn(`Friend Request with id: ${requestId} not found`);
        throw new DefaultHttpException(
          `Friend Request with id: ${requestId} not found`,
          'Check the id or create new friend request',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log('Friend Request found');
      return request;
    } catch (error) {
      this.logger.error('Error finding friend request:', error);
      if (error.code === '22P02') {
        throw new DefaultHttpException(
          'Invalid Friend request ID',
          'Provide a valid Friend request id',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Failed to find friend request',
        'An unexpected error occurred while searching for the friend request',
        'Friends Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  getFriendStatus(senderId: string, receiverId: string) {
    return this.db
      .select({
        id: db_schema.Friend.id,
        status: db_schema.Friend.status,
        senderId: db_schema.Friend.senderId,
        receiverId: db_schema.Friend.receiverId,
      })
      .from(db_schema.Friend)
      .where(
        or(
          and(
            eq(db_schema.Friend.senderId, senderId),
            eq(db_schema.Friend.receiverId, receiverId),
          ),
          and(
            eq(db_schema.Friend.senderId, receiverId),
            eq(db_schema.Friend.receiverId, senderId),
          ),
        ),
      );
  }

  async updateFriendStatus(
    receiverId: string,
    requestId: string,
    updateFriendRequestStatusDto: UpdateFriendRequestStatusDto,
  ) {
    this.logger.log(
      `${receiverId} attempting to ${updateFriendRequestStatusDto.status} a friend request with Id ${requestId}`,
    );
    try {
      const request = await this.getFriendRequestById(requestId);
      if (request.receiverId != receiverId) {
        throw new DefaultHttpException(
          "You can't update this request status",
          'You are not the intended recipient of this request.',
          'Friends Service',
          HttpStatus.FORBIDDEN,
        );
      }

      if (request.status === updateFriendRequestStatusDto.status) {
        this.logger.warn(
          `Friend request status is already ${updateFriendRequestStatusDto.status} for request ID: ${requestId}`,
        );
        throw new DefaultHttpException(
          `The friend request is already in the ${updateFriendRequestStatusDto.status} state.`,
          'No update is needed as the status is already the same.',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedData: Partial<typeof db_schema.Friend.$inferSelect> = {
        status: updateFriendRequestStatusDto.status,
      };
      const [updatedRequest] = await this.db
        .update(db_schema.Friend)
        .set(updatedData)
        .where(eq(db_schema.Friend.id, requestId))
        .returning({
          id: db_schema.Friend.id,
          status: db_schema.Friend.status,
          updatedAt: db_schema.Friend.updatedAt,
        });

      this.logger.log(
        `Friend request with ID ${requestId} updated to ${updateFriendRequestStatusDto.status}`,
      );
      return {
        message: `Succssefly ${updatedRequest.status} friend request`,
        updatedRequest,
      };
    } catch (error) {
      this.logger.error('Error updating friend request status', error);
      if (error instanceof DefaultHttpException) {
        throw error;
      }
      throw new DefaultHttpException(
        'Failed to update the friend request status.',
        'An internal server error occurred while processing your request.',
        'Friends Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteFriendRequest(userId: string, requestId: string) {
    this.logger.log(
      `${userId} attempting to delete friend request with ID ${requestId}`,
    );
    try {
      const friendRequest = await this.getFriendRequestById(requestId);

      if (
        friendRequest.senderId !== userId &&
        friendRequest.receiverId !== userId
      ) {
        this.logger.warn(
          `${userId} is not authorized to delete friend request with ID ${requestId}.`,
        );
        throw new DefaultHttpException(
          "You can't delete this friend request.",
          'You are neither the sender nor the receiver of this request.',
          'Friends Service',
          HttpStatus.FORBIDDEN,
        );
      }

      await this.db
        .delete(db_schema.Friend)
        .where(eq(db_schema.Friend.id, requestId));

      this.logger.log(
        `Friend request with ID ${requestId} deleted successfully.`,
      );
      return {
        message: `Friend request with ID ${requestId} has been deleted successfully.`,
      };
    } catch (error) {
      this.logger.error(
        `Error deleting friend request with ID ${requestId}`,
        error,
      );

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Failed to delete friend request.',
        'An internal server error occurred while processing your request.',
        'Friends Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getFriends(userId: string, getFriendsQuery: GetFriendsQueryDto) {
    const { limit, offset, status, order } = getFriendsQuery;
    this.logger.log(
      `Fetching friends by: limit=${limit}, offset=${offset}, status=${status} order=${order}`,
    );

    const friends = await this.db
      .select({
        requestId: db_schema.Friend.id,
        status: db_schema.Friend.status,
        email: db_schema.User.email,
        username: db_schema.User.username,
        profilePicture: db_schema.User.profilePicture,
      })
      .from(db_schema.Friend)
      .leftJoin(
        db_schema.User,
        or(
          and(
            eq(db_schema.Friend.senderId, db_schema.User.id),
            eq(db_schema.Friend.receiverId, userId),
          ),
          and(
            eq(db_schema.Friend.receiverId, db_schema.User.id),
            eq(db_schema.Friend.senderId, userId),
          ),
        ),
      )
      .where(
        and(
          or(
            eq(db_schema.Friend.senderId, userId),
            eq(db_schema.Friend.receiverId, userId),
          ),
          eq(db_schema.Friend.status, status),
        ),
      );

    this.logger.log('Fetched all friends');
    return friends;
  }
}
