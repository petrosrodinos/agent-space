import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StorageService } from './storage.service';

@Global()
@Module({
    imports: [JwtModule.register({})],
    providers: [StorageService],
    exports: [StorageService],
})
export class StorageIntegrationModule { }
