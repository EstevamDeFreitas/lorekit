import 'reflect-metadata';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvironmentService } from './config/environment.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
      exposeHeadRoutes: false,
    }),
  );
  const environment = app.get(EnvironmentService).values;

  app.getHttpAdapter().getInstance().addContentTypeParser(
    /^image\/(?:png|jpeg|webp|gif|avif)$/,
    { parseAs: 'buffer', bodyLimit: 25 * 1024 * 1024 },
    (_request, body, done) => {
      done(null, body);
    },
  );

  app.getHttpAdapter().getInstance().addContentTypeParser(
    'application/x-lorekit-cloud-backup',
    (_request, payload, done) => done(null, payload),
  );

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: environment.nodeEnv === 'production' ? undefined : false,
  });
  app.enableCors({
    origin: environment.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Lorekit API')
    .setDescription('Authentication and synchronization API for Lorekit clients.')
    .setVersion(environment.appVersion)
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    {
      ui: false,
      raw: ['json'],
      jsonDocumentUrl: '/openapi.json',
    },
  );

  await app.listen(environment.port, environment.host);
}

void bootstrap().catch((error: unknown) => {
  console.error('Lorekit API failed to start.', error);
  process.exitCode = 1;
});
