import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { User } from './user';
import { relations } from 'drizzle-orm';

export const VerificationCode = pgTable('verification_code', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: pgEnum('verification_code_type', ['email', 'password_reset', 'phone_number'])().notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  userId: uuid('user_id').notNull().references(() => User.id, { onDelete: 'cascade' }),
});


export const verificationUser = relations(VerificationCode, ({ one }) => ({
  user: one(User, {
    fields: [VerificationCode.userId],
    references: [User.id],
  }),
}));