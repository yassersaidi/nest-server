import { DefaultHttpException } from '@/common/errors/error/custom-error.error';
import { DrizzleAsyncProvider } from '@/database/database.module';
import * as db_schema from '@/database/schema';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { AddMemberDto } from './dto/add-members.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  InsertConversationMembersType,
  InsertConversationType,
} from './interfaces/conversation.interface';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
  ) {}
  async createConversation(
    creatorId: string,
    createConversationDto: CreateConversationDto,
  ) {
    this.logger.warn(
      `${creatorId} trying to create conversation with ${[...createConversationDto.members]}`,
    );
    try {
      //TODO(optional): check if the creator and the members are friends.
      if (createConversationDto.members.includes(creatorId)) {
        throw new DefaultHttpException(
          'Creator cannot be added as a member',
          'Please remove the creator from the members list',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }
      const conversationType: (typeof db_schema.conversationTypeEnum.enumValues)[number] =
        createConversationDto.members.length > 1 ? 'GROUP' : 'DIRECT';

      const conversationData: InsertConversationType = {
        title: createConversationDto.title ?? null,
        type: conversationType,
        createdBy: creatorId,
      };
      let conversationMembers: InsertConversationMembersType[] = [];
      let conversation: { id?: string } = {};

      await this.db.transaction(async (tx) => {
        const existingConversations = await tx
          .select({
            id: db_schema.Conversation.id,
          })
          .from(db_schema.Conversation)
          .innerJoin(
            db_schema.ConversationMember,
            eq(
              db_schema.Conversation.id,
              db_schema.ConversationMember.conversationId,
            ),
          )
          .where(
            inArray(db_schema.ConversationMember.userId, [
              creatorId,
              ...createConversationDto.members,
            ]),
          )
          .groupBy(db_schema.Conversation.id)
          .having(
            sql`count(${db_schema.ConversationMember.userId}) = ${
              [creatorId, ...createConversationDto.members].length
            }`,
          );

        if (existingConversations.length > 0) {
          throw new DefaultHttpException(
            'Duplicate conversation',
            'A conversation with the same members already exists',
            'Conversation Service',
            HttpStatus.BAD_REQUEST,
          );
        }

        [conversation] = await tx
          .insert(db_schema.Conversation)
          .values(conversationData)
          .returning({ id: db_schema.Conversation.id });

        const conversationId = conversation.id;

        conversationMembers = [
          {
            userId: creatorId,
            conversationId,
            role: db_schema.memberRoleEnum.enumValues[0],
            lastReadAt: new Date(),
          },
          ...createConversationDto.members.map((memberId) => ({
            userId: memberId,
            conversationId,
            lastReadAt: new Date(),
          })),
        ];

        await tx
          .insert(db_schema.ConversationMember)
          .values(conversationMembers);
      });
      this.logger.log(
        `${creatorId} Succssefly created a conversation with ${[...createConversationDto.members]}`,
      );
      return {
        message: 'Conversation created successfully',
        conversation,
        members: conversationMembers,
      };
    } catch (error) {
      console.log(error);
      this.logger.error(
        `Error creating conversation from ${creatorId}`,
        error.stack,
      );

      if (
        error.code === '23503' &&
        error.constraint === 'conversation_member_user_id_user_id_fk'
      ) {
        const match = error.detail.match(/(?<=\(user_id\)=\()(.*?)(?=\))/);
        const userId = match[0];
        throw new DefaultHttpException(
          'Invalid user ID',
          `User with ID ${userId} does not exist`,
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to create conversation',
        'Please try again later',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getConversationById(userId: string, conversationId: string) {
    try {
      this.logger.log(
        `Searching for conversation with ID: ${conversationId} for user: ${userId}`,
      );

      const conversation = await this.db.query.Conversation.findFirst({
        columns: {
          id: true,
          status: true,
          title: true,
          type: true,
          createdBy: true,
        },
        with: {
          members: {
            columns: {},
            limit: 5,
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
        },
        where: (conversation) => {
          return and(
            eq(conversation.id, conversationId),
            isNull(conversation.deletedAt),
            exists(
              this.db
                .select()
                .from(db_schema.ConversationMember)
                .where(
                  and(
                    eq(
                      db_schema.ConversationMember.conversationId,
                      conversation.id,
                    ),
                    eq(db_schema.ConversationMember.userId, userId),
                  ),
                ),
            ),
          );
        },
      });
      if (!conversation) {
        this.logger.warn(
          `Conversation with id: ${conversationId} not found or user with id ${userId} does not exist on it.`,
        );
        throw new DefaultHttpException(
          `Conversation with id: ${conversationId} not found`,
          'Check the id or create new conversation',
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        );
      }
      this.logger.log('Conversation found and user is a member');
      return conversation;
    } catch (error) {
      this.logger.error('Error finding conversation:', error);
      if (error.code === '22P02') {
        throw new DefaultHttpException(
          'Invalid conversation ID',
          'Provide a valid conversation id',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Failed to find conversation',
        'An unexpected error occurred while searching for the conversation',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserConversations(
    userId: string,
    getConversationDto: PaginationDto,
  ) {
    this.logger.warn(`${userId} trying to get his conversations`);

    const { limit, offset } = getConversationDto;

    const conversations = await this.db.query.Conversation.findMany({
      limit,
      offset,
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
      where: (conversation) => {
        return and(
          isNull(db_schema.Conversation.deletedAt),
          or(
            eq(conversation.createdBy, userId),
            exists(
              this.db
                .select()
                .from(db_schema.ConversationMember)
                .where(
                  and(
                    eq(
                      db_schema.ConversationMember.conversationId,
                      conversation.id,
                    ),
                    eq(db_schema.ConversationMember.userId, userId),
                  ),
                ),
            ),
          ),
        );
      },
    });

    return conversations;
  }

  async updateConversation(
    userId: string,
    conversationId: string,
    updateConversationDto: UpdateConversationDto,
  ) {
    try {
      this.logger.log(
        `Updating conversation with ID: ${conversationId} by user: ${userId}`,
      );
      // TODO?: Check if the status or the title are the same so no need to update them(optional)

      const [conversation] = await this.db
        .update(db_schema.Conversation)
        .set(updateConversationDto as any)
        .where(
          and(
            eq(db_schema.Conversation.id, conversationId),
            eq(db_schema.Conversation.createdBy, userId),
            isNull(db_schema.Conversation.deletedAt),
          ),
        )
        .returning({ id: db_schema.Conversation.id });

      if (!conversation) {
        this.logger.warn(
          `User ${userId} is not the owner of conversation ${conversationId}`,
        );
        throw new DefaultHttpException(
          `The Conversation with id ${conversationId} does not exist`,
          'Make sure this conversation exists and try again',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        );
      }

      this.logger.log(`Conversation ${conversationId} updated successfully`);

      return {
        message: `Conversation ${conversationId} updated successfully`,
        updatedFields: updateConversationDto,
      };
    } catch (error) {
      this.logger.error('Error updating conversation:', error);
      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Failed to update conversation',
        'An unexpected error occurred while updating the conversation',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteConversation(userId: string, conversationId: string) {
    try {
      this.logger.log(
        `Updating conversation with ID: ${conversationId} by user: ${userId}`,
      );

      const [conversation] = await this.db
        .update(db_schema.Conversation)
        .set({ deletedAt: new Date() } as any)
        .where(
          and(
            eq(db_schema.Conversation.id, conversationId),
            eq(db_schema.Conversation.createdBy, userId),
            isNull(db_schema.Conversation.deletedAt),
          ),
        )
        .returning({ id: db_schema.Conversation.id });

      if (!conversation) {
        this.logger.warn(
          `User ${userId} is not the owner of conversation ${conversationId}`,
        );
        throw new DefaultHttpException(
          `The Conversation with id ${conversationId} does not exist`,
          'Make sure this conversation exists and try again',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        );
      }

      this.logger.log(`Conversation ${conversationId} deleted successfully`);

      return {
        message: `Conversation ${conversationId} deleted successfully`,
      };
    } catch (error) {
      this.logger.error('Error deleting conversation:', error);
      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Failed to deleting conversation',
        'An unexpected error occurred while deleting the conversation',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addMember(
    creatorId: string,
    conversationId: string,
    addMemberDto: AddMemberDto,
  ) {
    this.logger.warn(
      `${creatorId} trying to add members:${[...addMemberDto.members]} to the conversation:${conversationId} `,
    );
    try {
      //TODO(optional): check if the creator and the members are friends.
      if (addMemberDto.members.includes(creatorId)) {
        throw new DefaultHttpException(
          'Creator cannot be added as a member',
          'Please remove the creator from the members list',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const conversation = await this.getConversationById(
        creatorId,
        conversationId,
      );

      if (conversation.createdBy != creatorId) {
        throw new DefaultHttpException(
          'Only the conversation creator can manage its members',
          'You do not have permissions to add members to this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        );
      }

      if (conversation.type === 'DIRECT') {
        throw new DefaultHttpException(
          'Cannot add members to a direct conversation',
          'Direct conversations are limited to two participants and cannot have additional members',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const conversationMembers: InsertConversationMembersType[] =
        addMemberDto.members.map((userId) => ({
          userId,
          conversationId,
          lastReadAt: new Date(),
        }));

      const result = await this.db
        .insert(db_schema.ConversationMember)
        .values(conversationMembers)
        .onConflictDoNothing({
          target: [
            db_schema.ConversationMember.userId,
            db_schema.ConversationMember.conversationId,
          ],
        })
        .returning({ userId: db_schema.ConversationMember.userId });
      this.logger.log(
        `${creatorId} Succssefly added ${[...addMemberDto.members]} to conversation with id: ${conversationId}`,
      );

      if (result.length === 0) {
        throw new DefaultHttpException(
          'Duplicate members',
          `Members were already in the conversation`,
          'Conversation Service',
          HttpStatus.CONFLICT,
        );
      }
      return {
        message: `Succssefly added members`,
        members: [...result],
      };
    } catch (error) {
      this.logger.error(
        `Error adding members to conversation: ${conversationId} from ${creatorId}`,
        error,
      );

      if (
        error.code === '23503' &&
        error.constraint === 'conversation_member_user_id_user_id_fk'
      ) {
        const match = error.detail.match(/(?<=\(user_id\)=\()(.*?)(?=\))/);
        const userId = match[0];
        throw new DefaultHttpException(
          'Invalid user ID',
          `User with ID ${userId} does not exist`,
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to add members to conversation',
        'Please try again later',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteMember(
    creatorId: string,
    conversationId: string,
    memberIdToDelete: string,
  ) {
    this.logger.warn(
      `${creatorId} trying to delete member:${memberIdToDelete} from the conversation:${conversationId}`,
    );
    try {
      const conversation = await this.getConversationById(
        creatorId,
        conversationId,
      );

      if (conversation.createdBy !== creatorId) {
        throw new DefaultHttpException(
          'Only the conversation creator can manage its members',
          'You do not have permissions to remove members from this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        );
      }

      if (conversation.type === 'DIRECT') {
        throw new DefaultHttpException(
          'Cannot remove members from a direct conversation',
          'Direct conversations are limited to two participants and cannot have members removed',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (memberIdToDelete === creatorId) {
        throw new DefaultHttpException(
          'Cannot remove the creator from the conversation',
          'The creator cannot be removed from the conversation',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      console.log(conversation);

      const result = await this.db
        .delete(db_schema.ConversationMember)
        .where(
          and(
            eq(db_schema.ConversationMember.userId, memberIdToDelete),
            eq(db_schema.ConversationMember.conversationId, conversationId),
          ),
        )
        .returning({ userId: db_schema.ConversationMember.userId });

      if (result.length === 0) {
        throw new DefaultHttpException(
          'Member not found',
          `The member with ID ${memberIdToDelete} is not in the conversation`,
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
        `${creatorId} successfully removed ${memberIdToDelete} from conversation with id: ${conversationId}`,
      );

      return {
        message: `Successfully removed member`,
        removedMember: result[0].userId,
      };
    } catch (error) {
      this.logger.error(
        `Error removing member from conversation: ${conversationId} by ${creatorId}`,
        error,
      );

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to remove member from conversation',
        'Please try again later',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateMemberRole(
    creatorId: string,
    conversationId: string,
    updateMemberDto: UpdateMemberDto,
  ) {
    const { memberId, ...updates } = updateMemberDto;
    this.logger.warn(
      `${creatorId} attempting to update member: ${memberId} in conversation: ${conversationId} with updates: ${JSON.stringify(updates)}`,
    );

    try {
      const conversation = await this.getConversationById(
        creatorId,
        conversationId,
      );

      if (conversation.createdBy !== creatorId) {
        throw new DefaultHttpException(
          'Only the conversation creator can manage members',
          'You do not have permissions to update members in this conversation',
          'Conversation Service',
          HttpStatus.FORBIDDEN,
        );
      }

      if (conversation.type === 'DIRECT') {
        throw new DefaultHttpException(
          'Cannot update members in a direct conversation',
          'Direct conversations do not have configurable member properties',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (updates.role && memberId === creatorId) {
        throw new DefaultHttpException(
          'Cannot update the role of the creator',
          "The creator's role cannot be changed",
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.db
        .update(db_schema.ConversationMember)
        .set(updates as any)
        .where(
          and(
            ne(db_schema.ConversationMember.role, updates.role),
            eq(db_schema.ConversationMember.userId, memberId),
            eq(db_schema.ConversationMember.conversationId, conversationId),
          ),
        )
        .returning({
          userId: db_schema.ConversationMember.userId,
          role: db_schema.ConversationMember.role,
        });

      if (result.length === 0) {
        throw new DefaultHttpException(
          `Member not found or their role is already: ${updates.role}`,
          `Try again with a different member or update their role`,
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(
        `${creatorId} successfully updated member: ${memberId} role in conversation: ${conversationId} with updates: ${JSON.stringify(updates)}`,
      );

      return {
        message: 'Successfully updated member role',
        updatedMember: result[0],
      };
    } catch (error) {
      this.logger.error(
        `Error updating member role in conversation: ${conversationId} by ${creatorId}`,
        error,
      );

      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to update member role in conversation',
        'Please try again later',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async isMember(userId: string, conversationId: string): Promise<boolean> {
    try {
      this.logger.log(
        `Checking membership for user: ${userId} in conversation: ${conversationId}`,
      );

      const membership = await this.db.query.ConversationMember.findFirst({
        where: (member) =>
          and(
            eq(member.userId, userId),
            eq(member.conversationId, conversationId),
            eq(member.isActive, true),
            isNull(member.deletedAt),
          ),
        columns: {
          id: true,
        },
      });

      const isMemberResult = !!membership;

      this.logger.log(
        `Membership check result: ${isMemberResult ? 'Member' : 'Not a member'}`,
      );

      return isMemberResult;
    } catch (error) {
      this.logger.error('Error checking conversation membership:', error);

      if (error.code === '22P02') {
        throw new DefaultHttpException(
          'Invalid conversation or user ID',
          'Provide valid IDs for conversation and user',
          'Conversation Service',
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new DefaultHttpException(
        'Failed to check conversation membership',
        'An unexpected error occurred while checking membership',
        'Conversation Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getMessagesByConversation(
    userId: string,
    conversationId: string,
    paginationDto: PaginationDto,
  ) {
    const { limit, offset } = paginationDto;
    try {
      const isMember = await this.isMember(userId, conversationId);
      if (!isMember) {
        throw new DefaultHttpException(
          `Conversation with id: ${conversationId} not found`,
          'Check the id or create new conversation',
          'Conversation Service',
          HttpStatus.NOT_FOUND,
        );
      }
      const messages = await this.db.query.Message.findMany({
        where: (message) =>
          and(
            eq(message.conversationId, conversationId),
            isNull(message.deletedAt),
          ),
        limit,
        offset,
        orderBy: desc(db_schema.Message.createdAt),
        with: {
          sender: {
            columns: {
              id: true,
              username: true,
              profilePicture: true,
            },
          },
        },
      });

      return messages;
    } catch (error) {
      this.logger.error(
        `Error fetching messages for conversation ${conversationId}:`,
        error.stack,
      );
      if (error instanceof DefaultHttpException) {
        throw error;
      }

      throw new DefaultHttpException(
        'Unable to fetch messages for this conversation',
        'Please try again later',
        'Message Service',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
