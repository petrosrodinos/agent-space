import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ArtifactsService } from './artifacts.service';
import { ArtifactViewService } from './artifact-view.service';
import { ArtifactExportService } from './artifact-export.service';
import { ArtifactLiveDataService } from './artifact-live-data.service';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactViewController } from './artifact-view.controller';

/** Artifacts (§7.5): management API for the app, plus the isolated host that serves them. */
@Module({
    imports: [JwtModule.register({})],
    controllers: [ArtifactsController, ArtifactViewController],
    providers: [ArtifactsService, ArtifactViewService, ArtifactExportService, ArtifactLiveDataService],
    exports: [ArtifactsService],
})
export class ArtifactsModule { }
