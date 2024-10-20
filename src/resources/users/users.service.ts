import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { ConfigService } from '@nestjs/config';
import generateInitialsImage from 'src/utils/generateImage';

const bcrypt = require('bcryptjs');

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly configService: ConfigService

  ) { }

  async create(createUserDto: CreateUserDto) {

    const isEmailUsed = await this.findByEmail(createUserDto.email)
    console.log(isEmailUsed)
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
      password:hashedPassword,
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

  findById(id: string){
    return this.users.findOneBy({id})
  }

  async getMe(id: string){
    return this.users.findOne({
      where:{id},
      select:["email","id","username",'profilePicture',"verified"]
    })
  }

  async getAll() {
    const users = await this.users.find(
      {
        select: ['id', 'email', 'username', 'createdAt', 'verified', 'profilePicture']
      }
    )
    return users;
  }

}
