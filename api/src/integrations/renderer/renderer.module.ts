import { Global, Module } from '@nestjs/common';
import { RendererService } from './renderer.service';

/** Headless Chrome for artifact export (§7.5). */
@Global()
@Module({
    providers: [RendererService],
    exports: [RendererService],
})
export class RendererModule { }
