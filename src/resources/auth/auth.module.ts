import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionService } from './sessions/session.service';
import { VerificationCodeService } from './verification-code/verification-code.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService, VerificationCodeService],
})
export class AuthModule {}
