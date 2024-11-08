import { ConflictException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { ConfigService } from '@nestjs/config';
import { SearchUsersQueryDto } from './dto/search-users.dto';
import { DrizzleAsyncProvider } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as db_schema from '@/resources/database/schema';
import { eq, or } from 'drizzle-orm';
import { DefaultHttpException } from '../common/errors/error/custom-error.error';
import { UserVerificationFields } from './interfaces/user.interface';

type UserType = typeof db_schema.User.$inferSelect;
const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(DrizzleAsyncProvider) private db: NodePgDatabase<typeof db_schema>,
    private readonly configService: ConfigService
  ) {}

  async create(createUserDto: CreateUserDto) {
    this.logger.log('Creating user...');
    const hashedPassword = await bcrypt.hash(createUserDto.password, parseInt(this.configService.get('PASSWORD_SALT')));
    const userValues: typeof db_schema.User.$inferInsert = {
      ...createUserDto,
      password: hashedPassword,
    };
    
    try {
      const user = await this.db.insert(db_schema.User).values(userValues);
      this.logger.log('User created successfully');
      return user;
    } catch (error) {
      this.logger.error('Error creating user', error.stack);

      if (error.code === '23505') {
        const detail: string = error.detail;
        const regex = /Key \((\w+)\)=\(([^)]+)\) already exists/;
        const match = detail.match(regex);

        if (match) {
          const field = match[1];
          const value = match[2];
          this.logger.warn(`${value} already exists`);
          throw new DefaultHttpException(
            `${value} already exists`,
            `Enter new ${field}`,
            'Register Service',
            HttpStatus.CONFLICT
          );
        }
      }

      throw new DefaultHttpException(error, '', 'Register Service', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async findUser({ email, username, phoneNumber }: UserVerificationFields) {
    this.logger.log('Searching for user...');
    const conditions = [];
    if (email) conditions.push(eq(db_schema.User.email, email));
    if (username) conditions.push(eq(db_schema.User.username, username));
    if (phoneNumber) conditions.push(eq(db_schema.User.phoneNumber, phoneNumber));

    const users = await this.db.select().from(db_schema.User).where(or(...conditions)).limit(1);

    if (users.length === 0) {
      let notFoundMessage = 'User';
      if (email) notFoundMessage += ` with email: ${email} not found.`;
      if (username) notFoundMessage += ` with username: ${username} not found.`;
      if (phoneNumber) notFoundMessage += ` with phone number: ${phoneNumber} not found.`;

      this.logger.warn(notFoundMessage);
      throw new DefaultHttpException(
        notFoundMessage,
        'Check your information or create an account',
        'Users Service',
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log('User found');
    return users[0];
  }

  async findById(id: string) {
    this.logger.log(`Searching for user with ID: ${id}`);
    const users = await this.db.select().from(db_schema.User).where(eq(db_schema.User.id, id)).limit(1);
    if (users.length === 0) {
      this.logger.warn(`User with id: ${id} not found`);
      throw new DefaultHttpException(
        `User with id: ${id} not found`,
        'Check the id or create an account',
        'Users Service',
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log('User found');
    return users[0];
  }

  async getMe(id: string) {
    this.logger.log(`Fetching user details for ID: ${id}`);
    const user = await this.db
      .select({
        id: db_schema.User.id,
        email: db_schema.User.email,
        phoneNumber: db_schema.User.phoneNumber,
        username: db_schema.User.username,
        profilePicture: db_schema.User.profilePicture,
        emailVerified: db_schema.User.isEmailVerified,
        phoneNumberVerified: db_schema.User.isPhoneNumberVerified,
      })
      .from(db_schema.User)
      .where(eq(db_schema.User.id, id))
      .limit(1)
      .execute();

    if (user.length === 0) {
      this.logger.warn(`User with id: ${id} not found`);
      throw new DefaultHttpException(
        `User with id: ${id} not found`,
        'Check the id or create an account',
        'Users Service',
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log('User details fetched');
    return user[0];
  }

  async getAll() {
    this.logger.log('Fetching all users');
    const users = await this.db.select().from(db_schema.User);
    this.logger.log('Fetched all users');
    return users;
  }

  async searchUsers({ email, username }: SearchUsersQueryDto) {
    this.logger.log('Searching users with email or username');
    const users = await this.db
      .select()
      .from(db_schema.User)
      .where(or(eq(db_schema.User.email, email), eq(db_schema.User.username, username)));

    this.logger.log('Search completed');
    return users;
  }

  async updateUser(userId: string, updateData: Partial<UserType>) {
    this.logger.log(`Updating user with ID: ${userId}`);
    const updatedUsers = await this.db.update(db_schema.User).set(updateData).where(eq(db_schema.User.id, userId)).returning();

    if (updatedUsers.length === 0) {
      this.logger.warn(`User with ID: ${userId} not found for update`);
      throw new DefaultHttpException(
        `User with id: ${userId} not found`,
        'Check the id or create an account',
        'Users Service',
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log('User updated successfully');
    return updatedUsers[0];
  }

  async deleteUser(userId: string) {
    this.logger.log(`Deleting user with ID: ${userId}`);
    const deletedUsers = await this.db.delete(db_schema.User).where(eq(db_schema.User.id, userId));

    if (!deletedUsers) {
      this.logger.warn(`User with ID: ${userId} not found for deletion`);
      throw new DefaultHttpException(
        `User with id: ${userId} not found`,
        'Check the id or create an account',
        'Users Service',
        HttpStatus.BAD_REQUEST
      );
    }

    this.logger.log('User deleted successfully');
    return { message: 'Your account has been deleted' };
  }
}
