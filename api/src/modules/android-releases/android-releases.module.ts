import { Module } from '@nestjs/common';
import { AndroidReleasesController } from './android-releases.controller';
import { AndroidReleasesService } from './android-releases.service';

/** Public Android update manifest and APK downloads, served from the private releases folder in GCS (§14.2). */
@Module({
  controllers: [AndroidReleasesController],
  providers: [AndroidReleasesService],
})
export class AndroidReleasesModule {}
