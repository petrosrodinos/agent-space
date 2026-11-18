import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './shared/config/env/env.module';
import { PrismaModule } from './core/databases/prisma/prisma.module';
import { RedisModule } from './core/databases/redis/redis.module';
import { RedisService } from './core/databases/redis/redis.service';
import { QueuesModule } from './core/queues/queues.module';
import { BullBoardModule } from './core/queues/bull-board.module';
import { RealtimeCoreModule } from './core/realtime/realtime.module';
import { RedisThrottlerStorage } from './shared/services/throttler/redis-throttler.storage';
import { SecretsIntegrationModule } from './integrations/secrets/secrets.module';
import { StorageIntegrationModule } from './integrations/storage/storage.module';
import { OpenRouterIntegrationModule } from './integrations/openrouter/openrouter.module';
import { ComposioIntegrationModule } from './integrations/composio/composio.module';
import { MailIntegrationModule } from './integrations/mail/mail.module';
import { DaytonaModule } from './integrations/daytona/daytona.module';
import { AccessModule } from './modules/access/access.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { HealthModule } from './modules/health/health.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { workerOnlyMiddleware } from './shared/middleware/worker-only.middleware';
import { FEATURE_MODULES } from './feature-modules';
import { BackgroundModule } from './background/background.module';

const role = process.env.PROCESS_ROLE ?? 'all';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        RedisModule,
        QueuesModule,
        BullBoardModule,
        RealtimeCoreModule,
        ThrottlerModule.forRootAsync({
            inject: [RedisService],
            useFactory: (redis: RedisService) => ({
                throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
                storage: new RedisThrottlerStorage(redis),
            }),
        }),
        SecretsIntegrationModule,
        StorageIntegrationModule,
        DaytonaModule,
        OpenRouterIntegrationModule,
        ComposioIntegrationModule,
        MailIntegrationModule,
        AccessModule,
        NotificationsModule,
        AuthModule,
        UsersModule,
        OrganizationsModule,
        HealthModule,
        ...FEATURE_MODULES,
        ...(role === 'api' ? [] : [BackgroundModule]),
    ],
    controllers: [AppController],
    providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        if (role === 'worker') consumer.apply(workerOnlyMiddleware).forRoutes('*');
    }
}
