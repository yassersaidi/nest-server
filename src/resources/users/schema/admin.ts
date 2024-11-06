import { pgTable, uuid, text, timestamp, unique, foreignKey } from 'drizzle-orm/pg-core';
import { User } from './user';

export const Admin = pgTable('admin', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  userId: uuid('user_id').notNull().references(() => User.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

