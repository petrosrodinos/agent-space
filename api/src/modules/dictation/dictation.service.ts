import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** OpenAI's transcription endpoint accepts up to 25 MB; a few minutes of compressed speech is well under this. */
export const MAX_DICTATION_BYTES = 10 * 1024 * 1024;
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const ALLOWED_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'video/webm',
] as const;
const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/aac': 'aac',
};

/**
 * Dictation: speech → text for any text field. Separate from voice mode (§7.6): no session, no bot, nothing is sent
 * to a conversation. The audio is forwarded once to the transcription model and dropped; neither the audio nor the
 * transcript is stored or logged.
 */
@Injectable()
export class DictationService {
  private readonly logger = new Logger(DictationService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(
    file: Express.Multer.File | undefined,
  ): Promise<{ text: string }> {
    if (!file?.buffer?.length)
      throw new BadRequestException('No audio received');
    const type = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number]))
      throw new BadRequestException('Unsupported audio format');
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key)
      throw new ServiceUnavailableException(
        'Dictation is not set up on this server',
      );

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], { type }),
      `dictation.${EXTENSIONS[type] ?? 'webm'}`,
    );
    form.append(
      'model',
      this.config.get<string>('DICTATION_MODEL') || DEFAULT_MODEL,
    );
    form.append('response_format', 'json');
    form.append(
      'prompt',
      'The speaker talks English or Greek. Add punctuation.',
    );

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      // Status only: the response body can echo request details.
      this.logger.warn(`Transcription failed with status ${res.status}`);
      throw new BadRequestException('Could not transcribe the recording');
    }
    const data = (await res.json()) as { text?: string };
    return { text: String(data.text ?? '').trim() };
  }
}
