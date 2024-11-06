import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const User = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  phoneNumber:text('phone_number').unique().notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  username: text('username').unique().notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  isPhoneNumberVerified: boolean('is_phone_number_verified').default(false).notNull(),
  profilePicture: text('profile_picture').default('/uploads/profile/default_profile_picture.png').notNull(),
});
