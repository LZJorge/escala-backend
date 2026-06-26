import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Escala API')
    .setDescription('Academic management system API')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const logo = readFileSync(resolve('docs/public/assets/logo.webp')).toString(
    'base64',
  );

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Escala API',
    customCss: `
      .topbar-wrapper .link { content: '' !important; }
      .topbar-wrapper a.link img { display: none; }
      .topbar-wrapper a.link:after {
        content: '';
        display: block;
        width: 220px;
        height: 60px;
        background: url(data:image/webp;base64,${logo}) no-repeat center/contain;
      }
      .topbar { background: #1a1f36; }
      .swagger-ui .info { margin: 30px 0; }
      .swagger-ui .info .title { color: #1a1f36; }
      .swagger-ui .opblock-tag { color: #1a1f36; }
      .swagger-ui .opblock-tag:hover { color: #3b4a6b; }
      .swagger-ui .btn.authorize { border-color: #1a1f36; color: #1a1f36; }
      .swagger-ui .btn.authorize svg { fill: #1a1f36; }
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
