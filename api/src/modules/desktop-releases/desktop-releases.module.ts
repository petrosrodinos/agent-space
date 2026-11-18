import { Module } from '@nestjs/common';
import { DesktopReleasesController } from './desktop-releases.controller';
import { DesktopReleasesService } from './desktop-releases.service';

/** Public desktop update feed and downloads, served from the private releases folder in GCS (§14.2). */
@Module({
  controllers: [DesktopReleasesController],
  providers: [DesktopReleasesService],
})
export class DesktopReleasesModule {}
