import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { TimeoutInterceptor } from './resources/common/interceptors/timeout.interceptor';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerDocumentOptions, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    }),
  );
  app.useGlobalInterceptors(new TimeoutInterceptor(3000))

  const config = new DocumentBuilder()
    .setTitle('Nest Server APIs')
    .setDescription('The Nest Server API description')
    .setVersion('1.0')
    .addBearerAuth({
      name: "Auth Guard",
      in: "header",
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: 'Enter your access token to access protected routes'
    }, "AuthGuard")
    .build();

  const options: SwaggerCustomOptions = {
    useGlobalPrefix: false,
  };

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, documentFactory, options);

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}/api/v1`);
}
bootstrap();
