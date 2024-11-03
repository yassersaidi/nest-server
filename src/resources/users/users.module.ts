import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { Admin } from './entities/admin.entity';

@Module({
  imports:[TypeOrmModule.forFeature([User, Admin])],
  controllers: [UsersController],
  providers: [UsersService, JwtService],
  exports:[UsersService]
})
export class UsersModule {}
