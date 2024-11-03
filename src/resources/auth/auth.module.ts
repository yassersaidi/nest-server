import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../users/entities/session.entity';
import { JwtService } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { VerificationCode } from '../users/entities/verification.code.entity';
import { Admin } from '../users/entities/admin.entity';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Session, VerificationCode, Admin]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtService],
})
export class AuthModule { }
