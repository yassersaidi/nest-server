import { BadRequestException, Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity';
import { loginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Session } from '../users/entities/session.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

const bcrypt = require('bcryptjs');

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Session) private readonly session: Repository<Session>,
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService
  ) { }

  
  async login(user: User, loginDto: loginDto) {

    const isValid = await bcrypt.compare(loginDto.password, user?.password)

    if (!isValid) {
      throw new BadRequestException("Invalid credentials")
    }

    const accessToken = this.tokenService.sign(
      { userId: user.id },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      },
    );

    const refreshToken = this.tokenService.sign(
      { userId: user.id },
      {
        secret: this.configService.get('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_TOKEN_EXPIRES_IN'),
      },
    );

    const sessionData = this.session.create({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await this.session.save(sessionData);

    return {
      accessToken,
      refreshToken,
      userId: user.id
    }
  }
}
