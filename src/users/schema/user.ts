import { Session } from '@/auth/sessions/schema/session';
import { VerificationCode } from '@/auth/verification-code/schema/verification.code';
import {
  Conversation,
  ConversationMember,
} from '@/conversation/schema/conversation';
import { timestamps } from '@/database/helpers/timestamp.type';
import { Friend } from '@/friends/schema/friends';
import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

export const rolesEnum = pgEnum('user_roles_enum', [
  'SUPER_ADMIN',
  'ADMIN',
  'USER',
]);

export const User = pgTable(
  'user',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').unique().notNull(),
    phoneNumber: text('phone_number').unique().notNull(),
    password: text('password').notNull(),
    ...timestamps,
    username: text('username').unique().notNull(),
    isEmailVerified: boolean('is_email_verified').default(false).notNull(),
    isPhoneNumberVerified: boolean('is_phone_number_verified')
      .default(false)
      .notNull(),
    profilePicture: text('profile_picture')
      .default('/uploads/profile/default_profile_picture.png')
      .notNull(),
    role: rolesEnum().default('USER').notNull(),
  },
  (t) => [
    index('email_idx').on(t.email),
    index('phone_idx').on(t.phoneNumber),
    index('username_idx').on(t.username),
  ],
);

export const userSessions = relations(User, ({ many }) => ({
  sessions: many(Session),
}));

export const userVerificationCodes = relations(User, ({ many }) => ({
  verification_codes: many(VerificationCode),
}));

export const userFriends = relations(User, ({ many }) => ({
  sentFriendRequests: many(Friend, {
    relationName: 'sender',
  }),

  receivedFriendRequests: many(Friend, {
    relationName: 'receiver',
  }),
}));

export const userConversationRelations = relations(User, ({ many }) => ({
  conversations: many(Conversation),
  conversationMemberships: many(ConversationMember),
}));
