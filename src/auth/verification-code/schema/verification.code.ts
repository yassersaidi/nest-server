import { User } from '@/users/schema/user';
import { relations } from 'drizzle-orm';
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const VerificationCode = pgTable(
  'verification_code',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: pgEnum('verification_code_type', [
      'email',
      'password_reset',
      'phone_number',
    ])().notNull(),
    code: text('code').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('codeIdx').on(t.code),
    index('userIdIdx').on(t.userId),
    index('expiresAtIdx').on(t.expiresAt),
    index('typeIdx').on(t.type),
  ],
);

export const verificationUser = relations(VerificationCode, ({ one }) => ({
  user: one(User, {
    fields: [VerificationCode.userId],
    references: [User.id],
  }),
}));
