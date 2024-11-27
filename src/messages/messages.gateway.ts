import { AuthedUserReqType } from '@/auth/interfaces/authed-user.interface';
import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessagesGuard } from './guards/auth.guard';
import { MessagesService } from './messages.service';
@UseGuards(MessagesGuard)
@WebSocketGateway({
  namespace: 'ws/messages',
  cors: {
    origin: '*', // TODO(important): update it to handle only incoming events from the frontend url
    methods: ['GET', 'POST'],
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    if (!client.data.user) {
      return;
    }
    const user: AuthedUserReqType = client.data.user;
    const conversation: string = client.data.conversation;
    this.server.to(conversation).emit('userJoined', user.username);
  }
  handleDisconnect(@ConnectedSocket() client: any) {
    if (!client.data.user) {
      return;
    }
    const user: AuthedUserReqType = client.data.user;
    const conversation: string = client.data.conversation;
    this.server.to(conversation).emit('userLeft', user.username);
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(@ConnectedSocket() client: Socket) {
    const user: AuthedUserReqType = client.data.user;
    const conversation: string = client.data.conversation;
    client.join(conversation);
    this.server.to(conversation).emit('joinedConversation', user.username);
    this.server.to(conversation).emit('userJoined', user.username);
    return { status: 'joined', conversation };
  }

  @SubscribeMessage('createMessage')
  async create(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('Received createMessage:', createMessageDto);
    try {
      const user: AuthedUserReqType = client.data.user;
      const conversation: string = client.data.conversation;

      const message = await this.messagesService.create(
        user.id,
        conversation,
        createMessageDto,
      );
      console.log('Created message:', message);

      this.server.to(conversation).emit('newMessage', {
        id: message.id,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
        sender: {
          id: user.id,
          username: user.username,
        },
      });
      console.log('Emitted newMessage event');
      return message;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }
  @SubscribeMessage('findOneMessage')
  findOne(@MessageBody() id: string) {
    return this.messagesService.findOne(id);
  }

  @SubscribeMessage('updateMessage')
  async update(
    @MessageBody() updateMessageDto: UpdateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const updatedMessage = await this.messagesService.update(
      updateMessageDto.id,
      updateMessageDto,
    );
    const conversation: string = client.data.conversation;
    this.server.to(conversation).emit('messageUpdated', updatedMessage);
    return updatedMessage;
  }

  @SubscribeMessage('removeMessage')
  async remove(@MessageBody() id: string, @ConnectedSocket() client: Socket) {
    console.log(id);
    const deletedMessage = await this.messagesService.remove(id);
    const conversation: string = client.data.conversation;
    this.server.to(conversation).emit('messageRemoved', id);
    return deletedMessage;
  }
}
