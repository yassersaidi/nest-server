import { User } from '@/database/schema';
import { relations } from 'drizzle-orm';
import { index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

export const friendshipStatusEnum = pgEnum('friendship_status_enum', [
  'PENDING',
  'ACCEPTED',
  'BLOCKED',
]);

export const Friend = pgTable(
  'friend',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    status: friendshipStatusEnum().default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('sender_receiver_idx').on(t.senderId, t.receiverId),
    index('status_idx').on(t.status),
  ],
);

export const friendRelations = relations(Friend, ({ one }) => ({
  sender: one(User, {
    fields: [Friend.senderId],
    references: [User.id],
  }),

  receiver: one(User, {
    fields: [Friend.receiverId],
    references: [User.id],
  }),
}));
