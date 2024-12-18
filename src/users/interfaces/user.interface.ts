import * as db_schema from '@/database/schema';

export type UserVerificationFields = {
  email?: string;
  phoneNumber?: string;
  username?: string;
};

export type UserSchemaType = typeof db_schema.User.$inferSelect;

export type UserResponse = Omit<UserSchemaType, 'password'>;

export type UserSearchType = Omit<
  UserSchemaType,
  | 'password'
  | 'createdAt'
  | 'updatedAt'
  | 'deletedAt'
  | 'isEmailVerified'
  | 'isPhoneNumberVerified'
  | 'role'
>;
