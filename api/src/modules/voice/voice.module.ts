import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';

/** Voice mode (§7.6). Lives in the API process: the sideband socket stays with the instance that set up the call. */
@Module({
    imports: [AgentModule],
    controllers: [VoiceController],
    providers: [VoiceService],
})
export class VoiceModule { }
