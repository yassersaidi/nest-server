import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../users/entities/session.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([Session]),
  JwtModule.registerAsync({
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => ({}),
  }),

  ],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule { }
