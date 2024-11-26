import { IsIn, IsOptional } from 'class-validator';
import { conversationStatusEnum } from '../schema/conversation';

export class UpdateConversationDto {
  @IsOptional()
  @IsIn([...Object.values(conversationStatusEnum.enumValues)])
  status?: string;

  @IsOptional()
  title?: string;
}
