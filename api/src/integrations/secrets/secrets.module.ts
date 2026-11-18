import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { SecretStoreService } from './secret-store.service';

@Global()
@Module({
    imports: [PrismaModule],
    providers: [SecretStoreService],
    exports: [SecretStoreService],
})
export class SecretsIntegrationModule { }
