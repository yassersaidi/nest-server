import { AuthedUserReqType } from '@/auth/interfaces/authed-user.interface';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class IsAuthed implements CanActivate {
  constructor(
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException({
        message: 'Your access token is missing',
        solution: 'Provide your access token in authorization header.',
        from: 'Auth Guard',
      });
    }

    try {
      const { id, username, role, sessionId } =
        await this.tokenService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET'),
        });

      if (!id) {
        throw new UnauthorizedException();
      }

      const authedUser: AuthedUserReqType = {
        id,
        username,
        role,
        sessionId,
      };
      request.authedUser = authedUser;
    } catch (error) {
      throw new UnauthorizedException({
        ...error,
        message: 'Your access token is expired',
        solution: 'Sign in again or refresh your token',
        from: 'Auth Guard',
      });
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
