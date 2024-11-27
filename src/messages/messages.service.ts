import { PaginationDto } from '@/common/dtos/pagination.dto';
import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
  ) {}

  async create(
    senderId: string,
    conversationId: string,
    createMessageDto: CreateMessageDto,
  ) {
    this.logger.log(`Creating message for conversation: ${conversationId}`);
    try {
      const [newMessage] = await this.db
        .insert(db_schema.Message)
        .values({
          conversationId: conversationId,
          senderId: senderId,
          receiverId: createMessageDto.receiverId,
          content: createMessageDto.content,
          status: 'SENT',
        } as any)
        .returning();

      this.logger.log(`Message created successfully with ID: ${newMessage.id}`);
      return newMessage;
    } catch (error) {
      this.logger.error(`Error creating message:`, error.stack);

      if (error.code === '23503') {
        throw new DefaultHttpException(
          'Invalid conversation id',
          'The conversation or user id does not exist',
          'Message Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new DefaultHttpException(
        'Unable to create message',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { limit, offset } = paginationDto;
    try {
      const messages = await this.db.query.Message.findMany({
        limit,
        offset,
        orderBy: desc(db_schema.Message.createdAt),
        where: isNull(db_schema.Message.deletedAt),
      });

      return messages;
    } catch (error) {
      this.logger.error('Error fetching messages:', error.stack);
      throw new DefaultHttpException(
        'Unable to fetch messages',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string) {
    try {
      const message = await this.db.query.Message.findFirst({
        where: (message) => and(eq(message.id, id), isNull(message.deletedAt)),
      });

      if (!message) {
        throw new DefaultHttpException(
          'Message not found',
          'The requested message does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        );
      }

      return message;
    } catch (error) {
      this.logger.error(`Error fetching message with ID ${id}:`, error.stack);

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to fetch message',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: string, updateMessageDto: UpdateMessageDto) {
    try {
      const [updatedMessage] = await this.db
        .update(db_schema.Message)
        .set(updateMessageDto)
        .where(
          and(
            eq(db_schema.Message.id, id),
            isNull(db_schema.Message.deletedAt),
          ),
        )
        .returning();

      if (!updatedMessage) {
        throw new DefaultHttpException(
          'Message not found',
          'The message you are trying to update does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
        `Message updated successfully with ID: ${updatedMessage.id}`,
      );
      return updatedMessage;
    } catch (error) {
      this.logger.error(`Error updating message with ID ${id}:`, error.stack);

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to update message',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: string) {
    try {
      const [deletedMessage] = await this.db
        .update(db_schema.Message)
        .set({ deletedAt: new Date() } as any)
        .where(
          and(
            eq(db_schema.Message.id, id),
            isNull(db_schema.Message.deletedAt),
          ),
        )
        .returning();

      if (!deletedMessage) {
        throw new DefaultHttpException(
          'Message not found',
          'The message you are trying to delete does not exist or has already been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
        `Message soft deleted successfully with ID: ${deletedMessage.id}`,
      );
      return deletedMessage;
    } catch (error) {
      this.logger.error(`Error deleting message with ID ${id}:`, error.stack);

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to delete message',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateMessageStatus(id: string, status: 'SENT' | 'DELIVERED' | 'READ') {
    try {
      const [updatedMessage] = await this.db
        .update(db_schema.Message)
        .set({ status } as any)
        .where(
          and(
            eq(db_schema.Message.id, id),
            isNull(db_schema.Message.deletedAt),
          ),
        )
        .returning();

      if (!updatedMessage) {
        throw new DefaultHttpException(
          'Message not found',
          'The message you are trying to update does not exist or has been deleted',
          'Message Service',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
        `Message status updated successfully for ID: ${updatedMessage.id}`,
      );
      return updatedMessage;
    } catch (error) {
      this.logger.error(
        `Error updating message status for ID ${id}:`,
        error.stack,
      );

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to update message status',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
