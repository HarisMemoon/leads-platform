import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';

async function bootstrap() {
  // bodyParser: false so we can register raw-body for the webhook route before JSON parsing
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Must come before express.json() — Stripe signature verification requires the raw body Buffer
  app.use('/stripe/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
