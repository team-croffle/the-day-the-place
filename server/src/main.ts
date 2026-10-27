import 'reflect-metadata';
import { API_PREFIX } from '@nest-vue/shared';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function isAuthPath(url: string): boolean {
  const path = url.split('?')[0] ?? '';
  return path === '/api/auth' || path.startsWith('/api/auth/');
}

async function bootstrap(): Promise<void> {
  // Better Auth가 요청 본문을 직접 읽는다. Nest 파서가 먼저 소비하면 가입·로그인이 멈춘다.
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: false });
  const config = app.get(ConfigService);
  const handler = toNodeHandler(app.get(AuthService).auth);

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!isAuthPath(req.originalUrl)) {
      next();
      return;
    }
    void handler(req, res);
  });
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  Logger.log(`Server listening on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
