import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '@/core/databases/prisma/prisma.module';
import { AccessService } from './access.service';
import { ActivityService } from '../activity/activity.service';
import { ActivityController } from '../activity/activity.controller';

/** Global cross-cutting services: permission checks and activity logging. */
@Global()
@Module({
    imports: [PrismaModule],
    controllers: [ActivityController],
    providers: [AccessService, ActivityService],
    exports: [AccessService, ActivityService, PrismaModule],
})
export class AccessModule { }
