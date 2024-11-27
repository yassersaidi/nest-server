import { PaginationDto } from '@/common/dtos/pagination.dto';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { MessagesService } from './messages.service';

const mockDb = {
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  query: {
    Message: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: DrizzleAsyncProvider, useValue: mockDb },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const senderId = 'sender-id';
    const conversationId = 'conversation-id';
    const createMessageDto = {
      receiverId: 'receiver-id',
      content: 'Hello',
    };

    it('Should create a new message successfully', async () => {
      const newMessage = { id: 'message-id', ...createMessageDto };
      mockDb.returning.mockResolvedValueOnce([newMessage]);

      const result = await service.create(
        senderId,
        conversationId,
        createMessageDto,
      );

      expect(result).toEqual(newMessage);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('Should throw error for invalid conversation ID', async () => {
      const dbError = { code: '23503' };
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        service.create(senderId, conversationId, createMessageDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Invalid conversation id',
          'The conversation or user id does not exist',
          'Message Service',
          HttpStatus.BAD_REQUEST,
        ),
      );
    });

    it('Should throw a default error on unexpected DB error', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        service.create(senderId, conversationId, createMessageDto),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to create message',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findAll', () => {
    const paginationDto: PaginationDto = { limit: 10, offset: 0 };

    it('Should return a list of messages', async () => {
      const messages = [{ id: 'msg1' }, { id: 'msg2' }];
      mockDb.query.Message.findMany.mockResolvedValueOnce(messages);

      const result = await service.findAll(paginationDto);

      expect(result).toEqual(messages);
      expect(mockDb.query.Message.findMany).toHaveBeenCalled();
    });

    it('Should throw an error on failure to fetch messages', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.query.Message.findMany.mockRejectedValueOnce(dbError);

      await expect(service.findAll(paginationDto)).rejects.toThrow(
        new DefaultHttpException(
          'Unable to fetch messages',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('findOne', () => {
    const messageId = 'valid-message-id';

    it('Should return a message if found', async () => {
      const mockMessage = { id: messageId, content: 'Hello' };
      mockDb.query.Message.findFirst.mockResolvedValueOnce(mockMessage);

      const result = await service.findOne(messageId);
      const whereClause = mockDb.query.Message.findFirst.mock.calls[0][0].where;
      whereClause({ messageId, deletedAt: null });

      expect(result).toEqual(mockMessage);
      expect(mockDb.query.Message.findFirst).toHaveBeenCalled();
    });

    it('Should throw error if message is not found', async () => {
      mockDb.query.Message.findFirst.mockResolvedValueOnce(undefined);

      await expect(service.findOne(messageId)).rejects.toThrow(
        new DefaultHttpException(
          'Message not found',
          'The requested message does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should handle unexpected errors gracefully', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.query.Message.findFirst.mockRejectedValueOnce(dbError);

      await expect(service.findOne(messageId)).rejects.toThrow(
        new DefaultHttpException(
          'Unable to fetch message',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('update', () => {
    const messageId = 'valid-message-id';
    const updateMessageDto = { id: messageId, content: 'Updated message' };

    it('Should update a message successfully', async () => {
      const updatedMessage = { id: messageId, ...updateMessageDto };
      mockDb.returning.mockResolvedValueOnce([updatedMessage]);

      const result = await service.update(messageId, updateMessageDto);

      expect(result).toEqual(updatedMessage);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('Should throw error if message is not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.update(messageId, updateMessageDto)).rejects.toThrow(
        new DefaultHttpException(
          'Message not found',
          'The message you are trying to update does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should handle unexpected errors gracefully', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(service.update(messageId, updateMessageDto)).rejects.toThrow(
        new DefaultHttpException(
          'Unable to update message',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('remove', () => {
    const messageId = 'valid-message-id';

    it('Should soft delete a message successfully', async () => {
      const deletedMessage = { id: messageId, deletedAt: new Date() };
      mockDb.returning.mockResolvedValueOnce([deletedMessage]);

      const result = await service.remove(messageId);

      expect(result).toEqual(deletedMessage);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('Should throw error if message is not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(service.remove(messageId)).rejects.toThrow(
        new DefaultHttpException(
          'Message not found',
          'The message you are trying to delete does not exist or has already been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should handle unexpected errors gracefully', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(service.remove(messageId)).rejects.toThrow(
        new DefaultHttpException(
          'Unable to delete message',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });

  describe('updateMessageStatus', () => {
    const messageId = 'valid-message-id';
    const status = 'DELIVERED';

    it('Should update the message status successfully', async () => {
      const updatedMessage = { id: messageId, status };
      mockDb.returning.mockResolvedValueOnce([updatedMessage]);

      const result = await service.updateMessageStatus(messageId, status);

      expect(result).toEqual(updatedMessage);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith({ status });
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it('Should throw error if message is not found', async () => {
      mockDb.returning.mockResolvedValueOnce([]);

      await expect(
        service.updateMessageStatus(messageId, status),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Message not found',
          'The message you are trying to update does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        ),
      );
    });

    it('Should handle unexpected errors gracefully', async () => {
      const dbError = new Error('Unexpected error');
      mockDb.returning.mockRejectedValueOnce(dbError);

      await expect(
        service.updateMessageStatus(messageId, status),
      ).rejects.toThrow(
        new DefaultHttpException(
          'Unable to update message status',
          'Please try again later',
          'Message Service',
          HttpStatus.INTERNAL_SERVER_ERROR,
        ),
      );
    });
  });
});
