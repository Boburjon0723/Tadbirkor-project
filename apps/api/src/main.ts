import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const normalizeOrigin = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const url = new URL(trimmed);
      return `${url.protocol}//${url.host}`;
    } catch {
      return trimmed.replace(/\/+$/, '');
    }
  };

  const rawOrigins = process.env.CORS_ORIGINS || '';
  const explicitOrigins = new Set(
    rawOrigins
      .split(',')
      .map((item) => normalizeOrigin(item))
      .filter(Boolean),
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl/postman)
      if (!origin) return callback(null, true);

      const normalizedOrigin = normalizeOrigin(origin);
      const isLocalhost =
        /^http:\/\/localhost:\d+$/.test(normalizedOrigin) ||
        /^http:\/\/127\.0\.0\.1:\d+$/.test(normalizedOrigin);
      const isAllowedExplicit = explicitOrigins.has(normalizedOrigin);
      const allowVercelPreview = process.env.CORS_ALLOW_VERCEL_PREVIEW === 'true';
      let isVercelPreview = false;
      if (allowVercelPreview) {
        try {
          isVercelPreview = /\.vercel\.app$/.test(new URL(origin).hostname);
        } catch {
          isVercelPreview = false;
        }
      }

      if (isLocalhost || isAllowedExplicit || isVercelPreview) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-storefront-token'],
    credentials: true,
  });

  // Increase payload limit for images
  const express = require('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Serve static files from uploads folder
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
