import { User } from '@/users/schema/user';
import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const Session = pgTable(
  'session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: text('ip_address').notNull(),
    deviceInfo: text('device_info').notNull(),
  },
  (t) => [
    index('session_id_idx').on(t.id),
    index('expires_at_idx').on(t.expiresAt),
    index('user_id_idx').on(t.userId),
  ],
);

export const sessionUser = relations(Session, ({ one }) => ({
  user: one(User, {
    fields: [Session.userId],
    references: [User.id],
  }),
}));
