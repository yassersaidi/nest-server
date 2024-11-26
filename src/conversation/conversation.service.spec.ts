import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { desc } from 'drizzle-orm';
import { vi } from 'vitest';
import { ConversationService } from './conversation.service';
import { AddMemberDto } from './dto/add-members.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

let transactionResult: any;

const mockDb = {
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  transaction: vi.fn().mockImplementation(async (callback) => {
    if (transactionResult instanceof Error) {
      throw transactionResult;
    }
    return callback(mockDb);
  }),
  query: {
    Conversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  onConflictDoNothing: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  having: vi.fn().mockReturnThis(),
};

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    transactionResult = null;
  });

  it('Conversation Service Should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    const creatorId = 'creator-id';
    const createConversationDto = {
      title: 'Test Conversation',
      members: ['member1-id', 'member2-id'],
    };

    it('Should create conversation', async () => {
      const conversationId = 'test-conversation-id';
      const conversationMembers = [
        {
          userId: creatorId,
          conversationId,
          role: db_schema.memberRoleEnum.enumValues[0],
          lastReadAt: expect.any(Date),
        },
        {
          userId: 'member1-id',
          conversationId,
          lastReadAt: expect.any(Date),
        },
        {
          userId: 'member2-id',
          conversationId,
          lastReadAt: expect.any(Date),
        },
      ];

      mockDb.having.mockResolvedValueOnce([]);
      mockDb.returning.mockImplementation(() => [{ id: conversationId }]);

      const result = await service.createConversation(
        creatorId,
        createConversationDto,
      );

      expect(result).toEqual({
        message: 'Conversation created successfully',
        conversation: { id: conversationId },
        members: conversationMembers,
      });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('Should create conversation with no title when there are no title provided in the dto', async () => {
      const createConversationDto = {
        members: ['member1-id', 'member2-id'],
      };
      const conversationId = 'test-conversation-id';

      const conversationMembers = [
        {
          userId: creatorId,
          conversationId,
          role: db_schema.memberRoleEnum.enumValues[0],
          lastReadAt: expect.any(Date),
        },
        {
          userId: 'member1-id',
          conversationId,
          lastReadAt: expect.any(Date),
        },
        {
          userId: 'member2-id',
          conversationId,
          lastReadAt: expect.any(Date),
        },
      ];

      mockDb.having.mockResolvedValueOnce([]);
      mockDb.returning.mockImplementation(() => [{ id: conversationId }]);

      const result = await service.createConversation(
        creatorId,
        createConversationDto,
      );

      expect(result).toEqual({
        message: 'Conversation created successfully',
        conversation: { id: conversationId },
        members: conversationMembers,
      });
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('Should throw an error if a duplicate conversation exists', async () => {
      const duplicateDto = {
        title: 'Duplicate Test',
        members: ['member1-id'],
      };

      mockDb.having.mockResolvedValueOnce([{ id: 'existing-conversation-id' }]);

      await expect(
        service.createConversation(creatorId, duplicateDto),
      ).rejects.toThrow(DefaultHttpException);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('Should throw an error if the creator is included in the members list', async () => {
      const invalidDto = {
        ...createConversationDto,
        members: ['creator-id', 'member1-id'],
      };

      await expect(
        service.createConversation(creatorId, invalidDto),
      ).rejects.toThrow(DefaultHttpException);
    });

    it('Should throw an error for invalid user IDs in members', async () => {
      const createConversationDto = {
        title: 'Invalid User Test',
        members: ['non-existent-id'],
      };

      const dbError = {
        code: '23503',
        constraint: 'conversation_member_user_id_user_id_fk',
        detail: '(user_id)=(non-existent-id)',
      };

      vi.spyOn(mockDb, 'transaction').mockImplementationOnce(() => {
        throw dbError;
      });

      await expect(
        service.createConversation(creatorId, createConversationDto),
      ).rejects.toThrow(DefaultHttpException);

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('Should log and throw an error on unexpected database errors', async () => {
      const dbError = new Error('Unexpected DB error');

      vi.spyOn(mockDb, 'transaction').mockImplementationOnce(() => {
        throw dbError;
      });

      await expect(
        service.createConversation(creatorId, createConversationDto),
      ).rejects.toThrow(DefaultHttpException);

      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe('getConversationById', () => {
    const userId = 'test-user-id';
    const conversationId = 'valid-conversation-id';

    it('Should return a conversation if found and user is a member', async () => {
      const mockConversation = {
        id: 'conversation-id-1',
        status: 'ACTIVE',
        title: 'Conversation 1',
        type: 'GROUP',
        createdBy: userId,
        members: [
          {
            user: {
              id: 'user-id-1',
              email: 'user1@example.com',
              username: 'user1',
              profilePicture: 'user1-pic.jpg',
            },
          },
          {
            user: {
              id: 'user-id-1',
              email: 'user2@example.com',
              username: 'user2',
              profilePicture: 'user2-pic.jpg',
            },
          },
        ],
      };

      mockDb.query.Conversation.findFirst.mockReturnValueOnce(mockConversation);

      const result = await service.getConversationById(userId, conversationId);

      const whereClause =
        mockDb.query.Conversation.findFirst.mock.calls[0][0].where;
      const conversationMock = { id: conversationId };
      whereClause(conversationMock);

      expect(result).toEqual(mockConversation);
    });

    it('Should throw DefaultHttpException if the conversation is not found or the user is not a member', async () => {
      mockDb.query.Conversation.findFirst.mockResolvedValueOnce(undefined);

      await expect(
        service.getConversationById(userId, conversationId),
      ).rejects.toThrow(
        new DefaultHttpException(
          `Conversation with id: ${conversationId} not found`,
          'Check the id or create new conversation',
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should throw DefaultHttpException for invalid conversation ID format', async () => {
      const invalidId = 'invalid-format';
      const dbError = { code: '22P02' };

      mockDb.query.Conversation.findFirst.mockRejectedValueOnce(dbError);

      await expect(
        service.getConversationById(userId, invalidId),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Invalid conversation ID',
          'Provide a valid conversation id',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw DefaultHttpException for unexpected errors', async () => {
      const unexpectedError = new Error('Unexpected database error');

      mockDb.query.Conversation.findFirst.mockRejectedValueOnce(
        unexpectedError,
      );

      await expect(
        service.getConversationById(userId, conversationId),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to find conversation',
          'An unexpected error occurred while searching for the conversation',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('getUserConversations', () => {
    const userId = 'test-user-id';
    const getConversationDto = {
      limit: 10,
      offset: 0,
    };

    it('Should return conversations with the correct structure', async () => {
      const mockConversations = [
        {
          id: 'conversation-id-1',
          status: 'ACTIVE',
          title: 'Conversation 1',
          type: 'GROUP',
          members: [
            {
              user: {
                id: 'user-id-1',
                email: 'user1@example.com',
                username: 'user1',
                profilePicture: 'user1-pic.jpg',
              },
            },
            {
              user: {
                id: 'user-id-1',
                email: 'user2@example.com',
                username: 'user2',
                profilePicture: 'user2-pic.jpg',
              },
            },
          ],
          messages: [
            {
              content: 'Last message content',
              createdAt: new Date(),
            },
          ],
        },
        {
          id: 'conversation-id-2',
          status: 'ACTIVE',
          title: 'Conversation 2',
          type: 'DIRECT',
          members: [
            {
              user: {
                id: 'user-id-1',
                email: 'user1@example.com',
                username: 'user1',
                profilePicture: 'user1-pic.jpg',
              },
            },
            {
              user: {
                id: 'user-id-1',
                email: 'user2@example.com',
                username: 'user2',
                profilePicture: 'user2-pic.jpg',
              },
            },
          ],
          messages: [
            {
              content: 'Another last message',
              createdAt: new Date(),
            },
          ],
        },
      ];

      mockDb.query.Conversation.findMany.mockResolvedValue(mockConversations);

      const result = await service.getUserConversations(
        userId,
        getConversationDto,
      );

      const whereClause =
        mockDb.query.Conversation.findMany.mock.calls[0][0].where;
      const mockConversation = { id: 'conv1', createdBy: 'user456' };
      whereClause(mockConversation);

      expect(result).toEqual(mockConversations);
      expect(mockDb.query.Conversation.findMany).toHaveBeenCalledWith({
        limit: getConversationDto.limit,
        offset: getConversationDto.offset,
        columns: {
          id: true,
          status: true,
          title: true,
          type: true,
        },
        with: {
          members: {
            columns: {},
            with: {
              user: {
                columns: {
                  id: true,
                  email: true,
                  username: true,
                  profilePicture: true,
                },
              },
            },
          },
          messages: {
            columns: {
              content: true,
              createdAt: true,
            },
            orderBy: desc(db_schema.Message.createdAt),
            limit: 1,
          },
        },
        where: expect.any(Function),
      });
    });

    it('Should handle no conversations found', async () => {
      mockDb.query.Conversation.findMany.mockResolvedValue([]);

      const result = await service.getUserConversations(
        userId,
        getConversationDto,
      );

      expect(result).toEqual([]);
      expect(mockDb.query.Conversation.findMany).toHaveBeenCalledWith({
        limit: getConversationDto.limit,
        offset: getConversationDto.offset,
        columns: {
          id: true,
          status: true,
          title: true,
          type: true,
        },
        with: {
          members: {
            columns: {},
            with: {
              user: {
                columns: {
                  id: true,
                  email: true,
                  username: true,
                  profilePicture: true,
                },
              },
            },
          },
          messages: {
            columns: {
              content: true,
              createdAt: true,
            },
            orderBy: desc(db_schema.Message.createdAt),
            limit: 1,
          },
        },
        where: expect.any(Function),
      });
    });
  });

  describe('updateConversation', () => {
    const userId = 'test-user-id';
    const conversationId = 'conversation-id';
    const updateConversationDto: UpdateConversationDto = {
      title: 'new title',
    };

    const mockConversation = {
      id: conversationId,
    };

    it('Should update the conversation with the new title', async () => {
      mockDb.returning.mockResolvedValue([mockConversation]);

      const result = await service.updateConversation(
        userId,
        conversationId,
        updateConversationDto,
      );

      expect(result).toStrictEqual({
        message: `Conversation ${conversationId} updated successfully`,
        updatedFields: updateConversationDto,
      });
    });

    it('Should throw an error if the conversation does not exist', async () => {
      mockDb.returning.mockResolvedValue([]);

      expect(
        service.updateConversation(
          userId,
          conversationId,
          updateConversationDto,
        ),
      ).rejects.toThrow(
        new DefaultHttpException(
          `The Conversation with id ${conversationId} does not exist`,
          'Make sure this conversation exists and try again',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('Should throw an error if the conversation does not exist', async () => {
      mockDb.returning.mockRejectedValue(new Error());

      expect(
        service.updateConversation(
          userId,
          conversationId,
          updateConversationDto,
        ),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to update conversation',
          'An unexpected error occurred while updating the conversation',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('deleteConversation', () => {
    const userId = 'test-user-id';
    const conversationId = 'conversation-id';

    const mockConversation = {
      id: conversationId,
    };

    it('Should delete the conversation', async () => {
      mockDb.returning.mockResolvedValue([mockConversation]);

      const result = await service.deleteConversation(userId, conversationId);

      expect(result).toStrictEqual({
        message: `Conversation ${conversationId} deleted successfully`,
      });
    });

    it('Should throw an error if the conversation does not exist', async () => {
      mockDb.returning.mockResolvedValue([]);

      expect(
        service.deleteConversation(userId, conversationId),
      ).rejects.toThrow(
        new DefaultHttpException(
          `The Conversation with id ${conversationId} does not exist`,
          'Make sure this conversation exists and try again',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('Should throw DefaultHttpException for unexpected errors', async () => {
      mockDb.returning.mockRejectedValue(new Error());

      expect(
        service.deleteConversation(userId, conversationId),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Failed to deleting conversation',
          'An unexpected error occurred while deleting the conversation',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('addMember', () => {
    const creatorId = 'creator-id';
    const conversationId = 'conversation-id';
    const addMemberDto: AddMemberDto = {
      members: ['member1-id', 'member2-id'],
    };

    const mockConversation = {
      id: conversationId,
      createdBy: creatorId,
      type: 'GROUP',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Should successfully add members to the conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([
        { userId: 'member1-id' },
        { userId: 'member2-id' },
      ]);

      const result = await service.addMember(
        creatorId,
        conversationId,
        addMemberDto,
      );

      expect(result).toEqual({
        message: 'Succssefly added members',
        members: [{ userId: 'member1-id' }, { userId: 'member2-id' }],
      });
    });

    it('Should throw an error if creator is included in members list', async () => {
      const invalidDto: AddMemberDto = {
        members: [creatorId, 'member1-id'],
      };

      await expect(
        service.addMember(creatorId, conversationId, invalidDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Creator cannot be added as a member',
          'Please remove the creator from the members list',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if user is not the conversation creator', async () => {
      const nonCreatorId = 'non-creator-id';
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        createdBy: 'different-creator-id',
      });

      await expect(
        service.addMember(nonCreatorId, conversationId, addMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Only the conversation creator can manage its members',
          'You do not have permissions to add members to this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('Should throw an error if trying to add members to a direct conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        type: 'DIRECT',
      });

      await expect(
        service.addMember(creatorId, conversationId, addMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Cannot add members to a direct conversation',
          'Direct conversations are limited to two participants and cannot have additional members',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if all members are already in the conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([]);

      await expect(
        service.addMember(creatorId, conversationId, addMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Duplicate members',
          'Members were already in the conversation',
          'Conversation Service',
          HttpStatus.CONFLICT,
        ),
      );
    });

    it('Should throw an error if a user does not exist', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockRejectedValue({
        code: '23503',
        constraint: 'conversation_member_user_id_user_id_fk',
        detail:
          'Key (user_id)=(non-existent-user-id) is not present in table "user".',
      });

      await expect(
        service.addMember(creatorId, conversationId, addMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Invalid user ID',
          'User with ID non-existent-user-id does not exist',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an internal server error for unexpected errors', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockRejectedValue(new Error('Unexpected error'));
      await expect(
        service.addMember(creatorId, conversationId, addMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to add members to conversation',
          'Please try again later',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('deleteMember', () => {
    const creatorId = 'creator-id';
    const conversationId = 'conversation-id';
    const memberIdToDelete = 'member-to-delete-id';

    const mockConversation = {
      id: conversationId,
      createdBy: creatorId,
      type: 'GROUP',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('Should successfully delete a member from the conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([{ userId: memberIdToDelete }]);

      const result = await service.deleteMember(
        creatorId,
        conversationId,
        memberIdToDelete,
      );

      expect(result).toEqual({
        message: 'Successfully removed member',
        removedMember: memberIdToDelete,
      });
    });

    it('Should throw an error if user is not the conversation creator', async () => {
      const nonCreatorId = 'non-creator-id';
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        createdBy: 'different-creator-id',
      });

      await expect(
        service.deleteMember(nonCreatorId, conversationId, memberIdToDelete),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Only the conversation creator can manage its members',
          'You do not have permissions to remove members from this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('Should throw an error if trying to remove a member from a direct conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        type: 'DIRECT',
      });

      await expect(
        service.deleteMember(creatorId, conversationId, memberIdToDelete),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Cannot remove members from a direct conversation',
          'Direct conversations are limited to two participants and cannot have members removed',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if trying to remove the creator', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);

      await expect(
        service.deleteMember(creatorId, conversationId, creatorId),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Cannot remove the creator from the conversation',
          'The creator cannot be removed from the conversation',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if the member is not found in the conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([]);

      await expect(
        service.deleteMember(creatorId, conversationId, memberIdToDelete),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Member not found',
          `The member with ID ${memberIdToDelete} is not in the conversation`,
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should throw an internal server error for unexpected errors', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        service.deleteMember(creatorId, conversationId, memberIdToDelete),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to remove member from conversation',
          'Please try again later',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('updateMemberRole', () => {
    const creatorId = 'creator-id';
    const conversationId = 'conversation-id';
    const memberId = 'member-id';
    const updateMemberDto: UpdateMemberDto = { memberId, role: 'ADMIN' };

    const mockConversation = {
      id: conversationId,
      createdBy: creatorId,
      type: 'GROUP',
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("Should successfully update a member's role", async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([
        { userId: memberId, role: updateMemberDto.role },
      ]);

      const result = await service.updateMemberRole(
        creatorId,
        conversationId,
        updateMemberDto,
      );

      expect(result).toEqual({
        message: 'Successfully updated member role',
        updatedMember: { userId: memberId, role: updateMemberDto.role },
      });
    });

    it('Should throw an error if the user is not the conversation creator', async () => {
      const nonCreatorId = 'non-creator-id';
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        createdBy: 'different-creator-id',
      });

      await expect(
        service.updateMemberRole(nonCreatorId, conversationId, updateMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Only the conversation creator can manage members',
          'You do not have permissions to update members in this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        ),
      );
    });

    it('Should throw an error if trying to update members in a direct conversation', async () => {
      service.getConversationById = vi.fn().mockResolvedValue({
        ...mockConversation,
        type: 'DIRECT',
      });

      await expect(
        service.updateMemberRole(creatorId, conversationId, updateMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Cannot update members in a direct conversation',
          'Direct conversations do not have configurable member properties',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if trying to update the role of the creator', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);

      const creatorUpdateDto: UpdateMemberDto = {
        memberId: creatorId,
        role: 'ADMIN',
      };

      await expect(
        service.updateMemberRole(creatorId, conversationId, creatorUpdateDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Cannot update the role of the creator',
          "The creator's role cannot be changed",
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw an error if the member is not found or already has the specified role', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.returning.mockResolvedValue([]);

      await expect(
        service.updateMemberRole(creatorId, conversationId, updateMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          `Member not found or their role is already: ${updateMemberDto.role}`,
          `Try again with a different member or update their role`,
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should throw an internal server error for unexpected errors', async () => {
      service.getConversationById = vi.fn().mockResolvedValue(mockConversation);
      mockDb.update.mockRejectedValue(new Error('Unexpected error'));

      await expect(
        service.updateMemberRole(creatorId, conversationId, updateMemberDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to update member role in conversation',
          'Please try again later',
          'Conversation Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });
});
