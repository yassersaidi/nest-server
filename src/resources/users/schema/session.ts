import { pgTable, uuid, text, timestamp, foreignKey } from 'drizzle-orm/pg-core';
import { User } from './user';
import { relations } from 'drizzle-orm';

export const Session = pgTable('session', {
  id: uuid('id').defaultRandom().primaryKey(),
  refreshToken: text('refresh_token').unique().notNull(),
  userId: uuid('user_id').notNull().references(() => User.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address').notNull(),        
  deviceInfo: text('device_info').notNull()       
});

export const sessionUser = relations(Session, ({ one }) => ({
  user: one(User, {
    fields: [Session.userId],
    references: [User.id],
  }),
}));