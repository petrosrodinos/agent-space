import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { JwtGuard } from '@/shared/guards/jwt.guard';
import { OrgGuard } from '@/shared/guards/org.guard';
import { DictationService, MAX_DICTATION_BYTES } from './dictation.service';

@ApiTags('Dictation')
@ApiBearerAuth()
@Controller('dictation')
@UseGuards(JwtGuard, OrgGuard)
export class DictationController {
  constructor(private readonly dictation: DictationService) {}

  /** Multipart `audio` field → `{ text }`. */
  @Post('transcribe')
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_DICTATION_BYTES, files: 1 },
    }),
  )
  transcribe(@UploadedFile() file: Express.Multer.File | undefined) {
    return this.dictation.transcribe(file);
  }
}
