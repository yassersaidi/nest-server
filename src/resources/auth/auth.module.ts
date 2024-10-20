import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../users/entities/session.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { VerificationCode } from '../users/entities/verification.code.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Session, VerificationCode]),

  ],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
})
export class AuthModule { }
