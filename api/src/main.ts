import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { parseCorsUrls, resolveCorsOrigins } from './shared/config/cors';
import { BULL_BOARD_ADAPTER } from './core/queues/queues.constants';
import { bullBoardAuthMiddleware } from './core/queues/bull-board.middleware';

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
    const config = app.get(ConfigService);
    const logger = new Logger('Bootstrap');

    app.set('trust proxy', 1);
    app.disable('x-powered-by');
    app.use(cookieParser());
    app.useBodyParser('json', { limit: '2mb' });
    // Local storage driver uploads (development): raw bytes, capped at the largest allowed file size.
    app.use('/api/files/local', express.raw({ type: () => true, limit: '101mb' }));
    app.setGlobalPrefix('api', { exclude: ['admin/queues', 'admin/queues/{*path}'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
    app.enableShutdownHooks();

    // Bull Board behind basic auth (§14.4 Operations).
    const bullBoard = app.get(BULL_BOARD_ADAPTER);
    app.use('/admin/queues', bullBoardAuthMiddleware(config), bullBoard.getRouter());

    const swaggerConfig = new DocumentBuilder()
        .setTitle('Agent Space API')
        .setDescription('Agent Space — personal and team AI co-workers')
        .setVersion('1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'X-Organization-Id', in: 'header' }, 'organization')
        .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

    // Every API call uses an absolute address; allowed origins are configurable per environment (§14.1).
    const origins = resolveCorsOrigins({
        nodeEnv: config.get('NODE_ENV'),
        corsUrls: parseCorsUrls(process.env.CORS_URLS),
        appUrl: config.get('APP_URL'),
        landingUrl: config.get('LANDING_URL'),
    });
    app.enableCors({
        origin: origins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Organization-Id', 'X-Client-Platform', 'X-App-Version'],
    });

    const port = Number(config.get('PORT') || 3000);
    await app.listen(port);
    logger.log(`Agent Space API (${config.get('PROCESS_ROLE')}) listening on :${port} — ${config.get('NODE_ENV')}`);
}
bootstrap();
