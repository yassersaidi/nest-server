import * as db_schema from '@/database/schema';

export type InsertConversationType = Omit<
  typeof db_schema.Conversation.$inferSelect,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'status' | 'lastMessageAt'
>;

export type InsertConversationMembersType = Omit<
  typeof db_schema.ConversationMember.$inferSelect,
  | 'id'
  | 'deletedAt'
  | 'joinedAt'
  | 'isActive'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
> & { role?: (typeof db_schema.memberRoleEnum.enumValues)[number] };
