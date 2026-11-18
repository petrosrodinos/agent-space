import { Global, Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { ModelsService } from './models.service';
import { CatalogController } from './catalog.controller';

@Global()
@Module({
    controllers: [CatalogController],
    providers: [CatalogService, ModelsService],
    exports: [ModelsService],
})
export class CatalogModule { }
