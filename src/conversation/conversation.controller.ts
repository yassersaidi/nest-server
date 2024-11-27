import { AuthedUserReqType } from '@/auth/interfaces/authed-user.interface';
import { AuthedUserReq } from '@/common/decorators/authed-user.decorator';
import { IsAuthed } from '@/common/guards/is.authed.guard';
import { UserRolesGuard } from '@/common/guards/user-roles.guard';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { ConversationService } from './conversation.service';
import { AddMemberDto } from './dto/add-members.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { DeleteMemberDto } from './dto/delete-member.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('Conversations')
@UseGuards(IsAuthed, UserRolesGuard)
@ApiBearerAuth('AuthGuard')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConversation(
    @Body() createConversationDto: CreateConversationDto,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.createConversation(
      user.id,
      createConversationDto,
    );
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getConversations(
    @AuthedUserReq() user: AuthedUserReqType,
    @Query() queryPagination: PaginationDto,
  ) {
    return this.conversationService.getUserConversations(
      user.id,
      queryPagination,
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getConversationById(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.getConversationById(
      user.id,
      conversationId,
    );
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateConversation(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() updateConversationDto: UpdateConversationDto,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.updateConversation(
      user.id,
      conversationId,
      updateConversationDto,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteConversation(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.deleteConversation(user.id, conversationId);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() addMemberDto: AddMemberDto,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.addMember(
      user.id,
      conversationId,
      addMemberDto,
    );
  }

  @Delete(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async deleteMember(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() { memberId }: DeleteMemberDto,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.deleteMember(
      user.id,
      conversationId,
      memberId,
    );
  }

  @Patch(':id/members/role')
  @HttpCode(HttpStatus.CREATED)
  async updateMemberRole(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @AuthedUserReq() user: AuthedUserReqType,
  ) {
    return this.conversationService.updateMemberRole(
      user.id,
      conversationId,
      updateMemberDto,
    );
  }

  @Get(':id/messages')
  async getConversationMessages(
    @AuthedUserReq() user: AuthedUserReqType,
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() queryPagination: PaginationDto,
  ) {
    return this.conversationService.getMessagesByConversation(
      user.id,
      conversationId,
      queryPagination,
    );
  }
}
