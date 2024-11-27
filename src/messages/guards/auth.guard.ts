import { ConversationService } from '@/conversation/conversation.service';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class MessagesGuard implements CanActivate {
  constructor(
    private readonly tokenService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationService: ConversationService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const wsClient: Socket = context.switchToWs().getClient();
    const accessToken = await this.extractToken(wsClient);
    if (!accessToken) {
      throw new WsException({
        message: 'Your access token is missing',
        solution: 'Provide your access token in authorization header.',
        from: 'Messages Guard',
      });
    }

    try {
      const { id, username, role, sessionId } =
        await this.tokenService.verifyAsync(String(accessToken), {
          secret: this.configService.get('JWT_SECRET'),
        });
      if (!id) {
        throw new WsException({
          message: 'Your access token is missing',
          solution: 'Provide your access token in authorization header.',
          from: 'Messages Guard',
        });
      }
      const conversationId = wsClient.handshake.query.conversationId as string;
      if (conversationId) {
        const isMember = await this.conversationService.isMember(
          id,
          conversationId,
        );

        if (!isMember) {
          throw new WsException({
            message: 'Not a member of this conversation',
            solution: "Make sure that you're member of this Conversation",
            from: 'Messages Guard',
          });
        }
      }
      wsClient.data.user = {
        id,
        username,
        role,
        sessionId,
      };
      wsClient.data.conversation = conversationId;
      return true;
    } catch (error) {
      throw new UnauthorizedException({
        ...error,
        message: 'Your access token is expired',
        solution: 'Sign in again or refresh your token',
        from: 'Auth Guard',
      });
    }
  }

  async extractToken(socket: Socket): Promise<string> {
    const authHeader = socket.handshake.headers.authorization as string;
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      return type === 'Bearer' ? token : undefined;
    }
  }
}
