import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChannelTransportService } from './channel-transport.service';
import { ChannelWebhooksController, ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

/** Message from anywhere: email, Slack and WhatsApp (§16). */
@Module({
    imports: [ConversationsModule],
    controllers: [ChannelsController, ChannelWebhooksController],
    providers: [ChannelsService, ChannelTransportService],
    exports: [ChannelsService],
})
export class ChannelsModule { }
