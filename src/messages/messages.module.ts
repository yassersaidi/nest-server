import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { ConversationModule } from '@/conversation/conversation.module';
import { ConversationService } from '@/conversation/conversation.service';

@Module({
  imports: [ConversationModule],
  providers: [MessagesGateway, MessagesService, ConversationService],
})
export class MessagesModule {}
