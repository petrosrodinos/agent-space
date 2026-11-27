import { Module } from '@nestjs/common';
import { DictationController } from './dictation.controller';
import { DictationService } from './dictation.service';

/** Speech-to-text for text fields. Independent of voice mode. */
@Module({
  controllers: [DictationController],
  providers: [DictationService],
})
export class DictationModule {}
