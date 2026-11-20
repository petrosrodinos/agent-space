import { Global, Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { MessagesService } from './messages.service';
import { MessageEventsService } from './message-events.service';
import { ConversationsController, MessagesController } from './conversations.controller';
import { RunsService } from '../runs/runs.service';
import { TasksService } from '../runs/tasks.service';
import { RunsController } from '../runs/runs.controller';
import { RunUndoService } from '../runs/run-undo.service';
import { ApprovalsService } from '../approvals/approvals.service';
import { ApprovalsController } from '../approvals/approvals.controller';

/** Conversations, messages, runs (tasks) and approvals — the chat core used by HTTP and by workers. */
@Global()
@Module({
    controllers: [ConversationsController, MessagesController, RunsController, ApprovalsController],
    providers: [ConversationsService, MessagesService, MessageEventsService, RunsService, TasksService, ApprovalsService, RunUndoService],
    exports: [ConversationsService, MessagesService, MessageEventsService, RunsService, ApprovalsService],
})
export class ConversationsModule { }
