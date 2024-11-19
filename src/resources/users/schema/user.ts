import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { Session } from './session';
import { VerificationCode } from './verification.code';

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
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp(),
    deletedAt: timestamp(),
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
