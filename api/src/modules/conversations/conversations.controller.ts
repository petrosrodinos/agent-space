import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard, type OrgMembership } from '@/shared/guards/org.guard';
import { CurrentMembership } from '@/shared/decorators/org-roles.decorator';
import { ZodValidationPipe } from '@/shared/pipes/zod.validation.pipe';
import type { Actor } from '../bots/bots.service';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import {
    AddParticipantsDto, ConversationListQuery, ConversationListSchema, CreateConversationDto, CreateDirectDto, CreateFolderDto, EditMessageDto,
    InteractionDto, MessagesQuery, MessagesQuerySchema, ReactDto, RetryMessageDto, SendMessageDto, UpdateConversationDto, UpdateMyConversationDto,
} from './dto/conversation.dto';

const actor = (m: OrgMembership): Actor => ({ user_id: m.user_id, organization_id: m.organization_id, role: m.role });

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtGuard, OrgGuard)
export class ConversationsController {
    constructor(
        private readonly conversations: ConversationsService,
        private readonly messages: MessagesService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Sidebar: my conversations in this organisation' })
    list(@CurrentMembership() m: OrgMembership, @Query(new ZodValidationPipe(ConversationListSchema)) q: ConversationListQuery) {
        return this.conversations.list(actor(m), q);
    }

    @Post('direct')
    direct(@CurrentMembership() m: OrgMembership, @Body() dto: CreateDirectDto) {
        return this.conversations.getOrCreateDirect(actor(m), dto);
    }

    @Post()
    create(@CurrentMembership() m: OrgMembership, @Body() dto: CreateConversationDto) {
        return this.conversations.create(actor(m), dto);
    }

    @Get('folders')
    folders(@CurrentMembership() m: OrgMembership) {
        return this.conversations.folders(actor(m));
    }

    @Post('folders')
    createFolder(@CurrentMembership() m: OrgMembership, @Body() dto: CreateFolderDto) {
        return this.conversations.createFolder(actor(m), dto.name);
    }

    @Delete('folders/:id')
    deleteFolder(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.deleteFolder(actor(m), id);
    }

    @Get(':id')
    get(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.get(actor(m), id);
    }

    @Patch(':id')
    update(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConversationDto) {
        return this.conversations.update(actor(m), id, dto);
    }

    @Patch(':id/me')
    updateMine(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMyConversationDto) {
        return this.conversations.updateMine(actor(m), id, dto);
    }

    @Post(':id/read')
    read(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.markRead(actor(m), id);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.conversations.remove(actor(m), id);
    }

    @Post(':id/participants')
    addParticipants(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddParticipantsDto) {
        return this.conversations.addParticipants(actor(m), id, dto);
    }

    @Delete(':id/participants/:participantId')
    removeParticipant(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Param('participantId', ParseUUIDPipe) pid: string) {
        return this.conversations.removeParticipant(actor(m), id, pid);
    }

    @Get(':id/messages')
    messagesList(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Query(new ZodValidationPipe(MessagesQuerySchema)) q: MessagesQuery) {
        return this.messages.list(actor(m), id, q);
    }

    @Get(':id/pinned')
    pinned(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.pinned(actor(m), id);
    }

    @Post(':id/messages')
    @Throttle({ default: { limit: 40, ttl: 60_000 } })
    @ApiOperation({ summary: 'Send a message. Bot replies are queued as runs and stream over the realtime channel.' })
    send(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendMessageDto) {
        return this.messages.send(actor(m), id, dto);
    }
}

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('messages')
@UseGuards(JwtGuard, OrgGuard)
export class MessagesController {
    constructor(private readonly messages: MessagesService) { }

    @Get('search')
    search(@CurrentMembership() m: OrgMembership, @Query('q') q: string) {
        return this.messages.search(actor(m), q);
    }

    @Patch(':id')
    edit(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: EditMessageDto) {
        return this.messages.edit(actor(m), id, dto);
    }

    @Delete(':id')
    remove(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.remove(actor(m), id);
    }

    @Post(':id/retry')
    retry(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RetryMessageDto) {
        return this.messages.retry(actor(m), id, dto);
    }

    @Post(':id/reactions')
    react(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReactDto) {
        return this.messages.react(actor(m), id, dto.emoji);
    }

    @Post(':id/pin')
    pin(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.togglePin(actor(m), id);
    }

    @Post(':id/interactions')
    interact(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InteractionDto) {
        return this.messages.interact(actor(m), id, dto);
    }

    @Get(':id/interactions')
    interactions(@CurrentMembership() m: OrgMembership, @Param('id', ParseUUIDPipe) id: string) {
        return this.messages.interactionResponses(actor(m), id);
    }
}
