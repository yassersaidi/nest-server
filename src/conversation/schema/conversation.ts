import { timestamps } from '@/database/helpers/timestamp.type';
import { User } from '@/database/schema';
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const messageStatusEnum = pgEnum('message_status', [
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
]);

export const conversationStatusEnum = pgEnum('conversation_status', [
  'ACTIVE',
  'ARCHIVED',
  'DELETED',
]);

export const memberRoleEnum = pgEnum('member_role', [
  'OWNER',
  'ADMIN',
  'MEMBER',
]);

export const conversationTypeEnum = pgEnum('conversation_type', [
  'DIRECT',
  'GROUP',
]);

export const Conversation = pgTable(
  'conversation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title'),
    createdBy: uuid('createdBy')
      .references(() => User.id, { onDelete: 'cascade' })
      .notNull(),
    status: conversationStatusEnum('status').default('ACTIVE').notNull(),
    type: conversationTypeEnum('type').default('GROUP').notNull(),
    lastMessageAt: timestamp('last_message_at').defaultNow().notNull(),
    ...timestamps,
  },
  (t) => [
    index('conversation_created_by_idx').on(t.createdBy),
    index('conversation_type_idx').on(t.type),
  ],
);

export const conversationRelations = relations(
  Conversation,
  ({ many, one }) => ({
    creator: one(User, {
      references: [User.id],
      fields: [Conversation.createdBy],
    }),
    messages: many(Message),
    members: many(ConversationMember),
  }),
);

export const ConversationMember = pgTable(
  'conversation_member',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => Conversation.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').default('MEMBER').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    lastReadAt: timestamp('last_read_at').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (t) => [
    index('conversation_member_conversation_id_idx').on(t.conversationId),
    index('conversation_member_user_id_idx').on(t.userId),
    uniqueIndex('conversation_member_user_conversation_unique').on(
      t.userId,
      t.conversationId,
    ),
  ],
);

export const conversationMemberRelations = relations(
  ConversationMember,
  ({ one }) => ({
    conversation: one(Conversation, {
      fields: [ConversationMember.conversationId],
      references: [Conversation.id],
    }),
    user: one(User, {
      fields: [ConversationMember.userId],
      references: [User.id],
    }),
  }),
);

export const Message = pgTable(
  'message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => Conversation.id, {
        onDelete: 'cascade',
      }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => User.id),
    receiverId: uuid('receiver_id').references(() => User.id),
    content: text('content').notNull(),
    status: messageStatusEnum('status').default('SENT').notNull(),
    ...timestamps,
  },
  (t) => [
    index('message_conversation_id_idx').on(t.conversationId),
    index('message_sender_id_idx').on(t.senderId),
    index('message_receiver_id_idx').on(t.receiverId),
  ],
);
export const messageRelations = relations(Message, ({ one }) => ({
  sender: one(User, {
    references: [User.id],
    fields: [Message.senderId],
  }),

  receiver: one(User, {
    references: [User.id],
    fields: [Message.receiverId],
  }),

  conversation: one(Conversation, {
    references: [Conversation.id],
    fields: [Message.conversationId],
  }),
}));
