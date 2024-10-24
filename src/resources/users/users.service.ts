import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';
import generateInitialsImage from 'src/utils/generateImage';
import { SearchUsersQueryDto } from './dto/search-users.dto';

const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly configService: ConfigService

  ) { }

  async create(createUserDto: CreateUserDto) {

    const isEmailUsed = await this.findByEmail(createUserDto.email)
    if (isEmailUsed) {
      throw new BadRequestException("this email is used by onther user")
    }

    const isUsernameUsed = await this.findByUsername(createUserDto.username)
    if (isUsernameUsed) {
      throw new BadRequestException("this username is used by onther user")
    }

    const profilePicture = await generateInitialsImage(createUserDto.username);
    const hashedPassword = await bcrypt.hash(createUserDto.password, parseInt(this.configService.get("PASSWORD_SALT")))

    const user = await this.users.create({
      ...createUserDto,
      password: hashedPassword,
      profilePicture
    })
    await this.users.save(user)
    return user.id
  }

  findByUsername(username: string) {
    return this.users.findOneBy({ username })
  }

  findByEmail(email: string) {
    return this.users.findOneBy({ email })
  }

  findById(id: string) {
    return this.users.findOneBy({ id })
  }

  async getMe(id: string) {
    const user = await this.users.createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.username', 'user.profilePicture', 'user.verified'])
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    return user;
  }

  async getAll() {
    const query = this.users.createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.username', 'user.profilePicture', 'user.verified', 'user.createdAt'])
    const users = await query.getMany();
    return users;
  }

  async searchUsers({ email, username }: SearchUsersQueryDto) {
    const query = this.users.createQueryBuilder('user')
      .select(['user.id', 'user.email', 'user.username', 'user.profilePicture'])
      .where('user.email = :email OR user.username = :username', { email, username });

    const users = await query.getMany();
    return users
  }

  async updateUser(userId: string, updateData: Partial<User>) {
    await this.users.update(userId, updateData);
  }

  async deleteUser(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    await this.users.delete(userId);
    return { message: 'your account has been deleted' };
  }


}
