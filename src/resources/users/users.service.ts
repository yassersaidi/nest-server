import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { DrizzleAsyncProvider } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as db_schema from '@/resources/database/schema';
import { eq, or } from 'drizzle-orm';

type UserType = typeof db_schema.User.$inferSelect
const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    private readonly configService: ConfigService

  ) { }

  async create(createUserDto: CreateUserDto) {

    const users = await this.db.select().from(db_schema.User).where(or(eq(db_schema.User.email, createUserDto.email), eq(db_schema.User.username, createUserDto.username))).limit(1)

    if (users.length > 0) {
      throw new NotFoundException("User with email/username is already exist")
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, parseInt(this.configService.get("PASSWORD_SALT")))

    const userValues: typeof db_schema.User.$inferInsert = {
      ...createUserDto,
      password: hashedPassword
    }

    const user = await this.db.insert(db_schema.User).values(userValues)
    return user
  }


  async findUser(email?: string, username?: string) {
    const users = await this.db.select().from(db_schema.User).where(or(eq(db_schema.User.email, email), eq(db_schema.User.username, username))).limit(1)

    if (users.length === 0) {
      throw new NotFoundException("User not found")
    }

    return users[0]
  }

  async findById(id: string) {

    const users = await this.db.select().from(db_schema.User).where(eq(db_schema.User.id, id)).limit(1)
    if (users.length === 0) {
      throw new NotFoundException("User not found")
    }

    return users[0]
  }

  async getMe(id: string) {
    const user = await this.db
      .select({
        id: db_schema.User.id,
        email: db_schema.User.email,
        phoneNumber: db_schema.User.phoneNumber,
        username: db_schema.User.username,
        profilePicture: db_schema.User.profilePicture,
        emailVerified: db_schema.User.isEmailVerified,
        phoneNumberVerified: db_schema.User.isPhoneNumberVerified
      })
      .from(db_schema.User)
      .where(eq(db_schema.User.id, id))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new NotFoundException(`User not found`);
    }

    return user[0];
  }

  async getAll() {
    const users = await this.db
      .select({
        id: db_schema.User.id,
        email: db_schema.User.email,
        phoneNumber: db_schema.User.phoneNumber,
        username: db_schema.User.username,
        profilePicture: db_schema.User.profilePicture,
        emailVerified: db_schema.User.isEmailVerified,
        phoneNumberVerified: db_schema.User.isPhoneNumberVerified
      })
      .from(db_schema.User)
    return users;
  }

  async searchUsers({ email, username }: SearchUsersQueryDto) {
    const users = await this.db
      .select({
        id: db_schema.User.id,
        email: db_schema.User.email,
        phoneNumber: db_schema.User.phoneNumber,
        username: db_schema.User.username,
        profilePicture: db_schema.User.profilePicture,
        emailVerified: db_schema.User.isEmailVerified,
        phoneNumberVerified: db_schema.User.isPhoneNumberVerified
      })
      .from(db_schema.User)
      .where(or(eq(db_schema.User.email, email), eq(db_schema.User.username, username)))
    return users
  }

  async updateUser(userId: string, updateData: Partial<UserType>) {
    const updatedUsers = await this.db.update(db_schema.User).set(updateData).where(eq(db_schema.User.id, userId)).returning();

    if (updatedUsers.length === 0) {
      throw new NotFoundException("User not found");
    }

    return updatedUsers[0]
  }

  async deleteUser(userId: string) {
    const deletedUsers = await this.db.delete(db_schema.User).where(eq(db_schema.User.id, userId)).returning();

    if (deletedUsers.length === 0) {
      throw new NotFoundException("User not found");
    }

    return { message: 'your account has been deleted' };
  }


}
