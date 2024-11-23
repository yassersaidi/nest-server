import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import { UsersService } from '@/users/users.service';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { UpdateFriendRequestStatusDto } from './dto/update-friend-request-status.dto';
import { FriendRequestStatus } from './enums/request-status.enum';
import { FriendsService } from './friends.service';

describe('Friends Service', () => {
  let service: FriendsService;
  let mockDb: any;
  let mockUsersService: any;

  beforeEach(async () => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockUsersService = {
      findById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Friends Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFriendRequest', () => {
    const mockSender = {
      id: 'sender-123',
    };

    const mockReceiver = {
      id: 'receiver-456',
    };

    const createFriendDto = {
      receiverId: mockReceiver.id,
    };

    it('Should create friend request successfully', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.returning.mockResolvedValue([
        { id: 'request-123', status: 'PENDING', createdAt: new Date() },
      ]);

      const result = await service.createFriendRequest(
        mockSender.id,
        createFriendDto,
      );

      expect(result).toEqual({
        message: 'Friend request sent successfully',
        friend: {
          id: 'request-123',
          status: 'PENDING',
          createdAt: expect.any(Date),
        },
      });
    });

    it('Should throw error when sending request to self', async () => {
      await expect(
        service.createFriendRequest(mockSender.id, {
          receiverId: mockSender.id,
        }),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw error when receiver does not exist', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw error when friend request already exists', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'PENDING',
          receiverId: mockReceiver.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw error when request is Pending', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'PENDING',
          receiverId: mockReceiver.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          `You already sent a friend request`,
          `You can send another request if the previous one is deleted`,
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw error when request is Pending and the sender is the receiver of that request', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'PENDING',
          receiverId: mockSender.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'You already received this friend request',
          'You can accept or block this friend request',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw error when request is Blocked', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'BLOCKED',
          receiverId: mockReceiver.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          `You can't send a friend request to this user`,
          `The user has blocked you or restricted requests`,
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw error when request is Blocked and the sender is the receiver of that request', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'BLOCKED',
          receiverId: mockSender.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'You blocked this friend request',
          'Unblock or delete this friend request',
          'Friends Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw error when users are already friends', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);
      mockDb.where.mockResolvedValue([
        {
          status: 'ACCEPTED',
          receiverId: mockReceiver.id,
        },
      ]);

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw Internal server error when error not expected', async () => {
      mockUsersService.findById.mockResolvedValue(mockReceiver);

      mockDb.insert.mockRejectedValue(
        new DefaultHttpException(
          'Unable to process the friend request',
          'Please try again later',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        service.createFriendRequest(mockSender.id, createFriendDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to process the friend request',
          'Please try again later',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('getFriendRequestById', () => {
    const mockRequest = {
      id: 'request-123',
      senderId: 'sender-123',
      receiverId: 'receiver-456',
      status: 'PENDING',
    };

    it('Should find friend request by id', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);

      const result = await service.getFriendRequestById(mockRequest.id);
      expect(result).toEqual(mockRequest);
    });

    it('Should throw error when request not found', async () => {
      mockDb.where.mockResolvedValue([]);

      await expect(
        service.getFriendRequestById('non-existent'),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw error on invalid UUID', async () => {
      mockDb.where.mockRejectedValue({ code: '22P02' });

      await expect(service.getFriendRequestById('invalid-id')).rejects.toThrow(
        DefaultHttpException,
      );
    });

    it('Should throw Internal server error when error not expected', async () => {
      mockDb.select.mockRejectedValue(
        new DefaultHttpException(
          'Failed to find friend request',
          'An unexpected error occurred while searching for the friend request',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        service.getFriendRequestById(mockRequest.id),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to find friend request',
          'An unexpected error occurred while searching for the friend request',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('updateFriendStatus', () => {
    const mockRequest = {
      id: 'request-123',
      senderId: 'sender-123',
      receiverId: 'receiver-456',
      status: 'PENDING',
    };

    const updateDto: UpdateFriendRequestStatusDto = {
      status: FriendRequestStatus.ACCEPTED,
    };

    it('Should update friend request status successfully', async () => {
      beforeEach(() => {
        mockDb.where.mockResolvedValueOnce([mockRequest]);
      });
      mockDb.where.mockResolvedValueOnce([mockRequest]);
      mockDb.returning.mockResolvedValue([
        {
          id: mockRequest.id,
          status: 'ACCEPTED',
          updatedAt: new Date(),
        },
      ]);

      const result = await service.updateFriendStatus(
        mockRequest.receiverId,
        mockRequest.id,
        updateDto,
      );

      expect(result).toEqual({
        message: 'Succssefly ACCEPTED friend request',
        updatedRequest: {
          id: mockRequest.id,
          status: 'ACCEPTED',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('Should throw error when user is not the receiver', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);

      await expect(
        service.updateFriendStatus('wrong-user', mockRequest.id, updateDto),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw error when status is already set', async () => {
      mockDb.where.mockResolvedValue([{ ...mockRequest, status: 'ACCEPTED' }]);

      await expect(
        service.updateFriendStatus(
          mockRequest.receiverId,
          mockRequest.id,
          updateDto,
        ),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw Internal server error when error not expected', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);
      mockDb.update.mockRejectedValue(
        new DefaultHttpException(
          'Failed to update the friend request status.',
          'An internal server error occurred while processing your request.',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        service.updateFriendStatus(
          mockRequest.receiverId,
          mockRequest.id,
          updateDto,
        ),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to update the friend request status.',
          'An internal server error occurred while processing your request.',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('deleteFriendRequest', () => {
    const mockRequest = {
      id: 'request-123',
      senderId: 'sender-123',
      receiverId: 'receiver-456',
      status: 'PENDING',
    };

    it('Should delete friend request successfully', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);

      const result = await service.deleteFriendRequest(
        mockRequest.senderId,
        mockRequest.id,
      );

      expect(result).toEqual({
        message: `Friend request with ID ${mockRequest.id} has been deleted successfully.`,
      });
    });

    it('Should allow receiver to delete request', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);

      const result = await service.deleteFriendRequest(
        mockRequest.receiverId,
        mockRequest.id,
      );

      expect(result).toEqual({
        message: `Friend request with ID ${mockRequest.id} has been deleted successfully.`,
      });
    });

    it('Should throw error when user is neither sender nor receiver', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);

      await expect(
        service.deleteFriendRequest('wrong-user', mockRequest.id),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw Internal server error when error not expected', async () => {
      mockDb.where.mockResolvedValue([mockRequest]);
      mockDb.delete.mockRejectedValue(
        new DefaultHttpException(
          'Failed to delete friend request.',
          'An internal server error occurred while processing your request.',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );

      await expect(
        service.deleteFriendRequest(mockRequest.senderId, mockRequest.id),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to delete friend request.',
          'An internal server error occurred while processing your request.',
          'Friends Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('getFriends', () => {
    const mockFriends = [
      {
        requestId: 'request-123',
        status: 'ACCEPTED',
        email: 'friend1@test.com',
        username: 'friend1',
        profilePicture: 'pic1.jpg',
      },
      {
        requestId: 'request-456',
        status: 'ACCEPTED',
        email: 'friend2@test.com',
        username: 'friend2',
        profilePicture: 'pic2.jpg',
      },
    ];

    it('Should get friends list successfully', async () => {
      mockDb.where.mockResolvedValue(mockFriends);

      const result = await service.getFriends('user-123', {
        limit: 10,
        offset: 0,
        status: FriendRequestStatus.ACCEPTED,
        order: 1,
      });

      expect(result).toEqual(mockFriends);
    });

    it('Should return empty array when no friends found', async () => {
      mockDb.where.mockResolvedValue([]);

      const result = await service.getFriends('user-123', {
        limit: 10,
        offset: 0,
        status: FriendRequestStatus.ACCEPTED,
        order: 1,
      });

      expect(result).toEqual([]);
    });
  });
});
