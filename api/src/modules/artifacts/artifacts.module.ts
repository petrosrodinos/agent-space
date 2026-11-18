import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ArtifactsService } from './artifacts.service';
import { ArtifactViewService } from './artifact-view.service';
import { ArtifactsController } from './artifacts.controller';
import { ArtifactViewController } from './artifact-view.controller';

/** Artifacts (§7.5): management API for the app, plus the isolated host that serves them. */
@Module({
    imports: [JwtModule.register({})],
    controllers: [ArtifactsController, ArtifactViewController],
    providers: [ArtifactsService, ArtifactViewService],
    exports: [ArtifactsService],
})
export class ArtifactsModule { }
