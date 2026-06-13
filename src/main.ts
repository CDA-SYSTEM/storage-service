import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

const basicAuth = require('express-basic-auth');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const swaggerUser = configService.get<string>('SWAGGER_USER');
  const swaggerPass = configService.get<string>('SWAGGER_PASS');
  if (swaggerUser && swaggerPass) {
    app.use(
      '/docs',
      basicAuth({
        challenge: true,
        users: { [swaggerUser]: swaggerPass },
      }),
    );
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Storage Service API')
    .setDescription('API para gestion de archivos con Cassandra')
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port);
  console.log(`Storage Service is running on port ${port}`);
  console.log(`Swagger is running on http://localhost:${port}/docs`);
}
bootstrap();
